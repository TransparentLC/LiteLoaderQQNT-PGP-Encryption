import childProcess from 'node:child_process';
import { ipcMain } from 'electron';
import { LRUCache } from 'lru-cache';
import * as GnuPG from '../gnupg.js';

const log = (...data) => console.log('\x1b[92mPGP-Encryption\x1b[39m', ...data);
const defaultConfig: {
    signKeyID: string | null,
    keyBinding: { uin: number, keyID: string }[],
} = {
    signKeyID: null,
    keyBinding: [],
};

const keychain: Map<string, GnuPG.KeyInfo> = new Map;
const privateSubkeys: Map<string, GnuPG.PrivateKeyInfo> = new Map;
const publicSubkeys: Map<string, GnuPG.PublicKeyInfo> = new Map;
const keyBindings: Map<number, GnuPG.PublicKeyInfo[]> = new Map;
let signKey: GnuPG.PrivateKeyInfo | null = null;
const decryptResultCache = new LRUCache<string, { stdout: string, stderr: string }>({
    max: 100,
    fetchMethod: key => new Promise((resolve, reject) => {
        const p = childProcess.execFile(
            'gpg',
            ['--decrypt'],
            { timeout: 30000 },
            (error, stdout, stderr) => error ? reject(stderr || error) : resolve({ stdout, stderr }),
        );
        p.stdin!.write(key);
        p.stdin!.end();
    }),
});

const parseColonKeyList = (colonKeyList: string) => {
    const keys: GnuPG.KeyInfo[] = [];
    let currentKey: GnuPG.KeyInfo | null = null;

    for (const line of colonKeyList.split('\n')) {
        const fields = line.trim().split(':');
        switch (fields[0]) {
            case 'sec':
            case 'pub':
                if (currentKey) keys.push(currentKey);
                currentKey = {
                    private: fields[0] === 'sec',
                    validity: {
                        i: GnuPG.KeyValidity.Invalid,
                        r: GnuPG.KeyValidity.Revoked,
                        e: GnuPG.KeyValidity.Expired,
                        n: GnuPG.KeyValidity.Never,
                        m: GnuPG.KeyValidity.Marginal,
                        f: GnuPG.KeyValidity.Full,
                        u: GnuPG.KeyValidity.Ultimate,
                    }[fields[1]] || GnuPG.KeyValidity.Unknown,
                    algorithm: parseInt(fields[3]),
                    curve: fields[16],
                    keyLength: parseInt(fields[2]),
                    keyID: fields[4],
                    creationDate: parseInt(fields[5]),
                    expirationDate: fields[6] ? parseInt(fields[6]) : undefined,
                    capabilities: {
                        encrypt: fields[11].includes('e'),
                        sign: fields[11].includes('s'),
                        certify: fields[11].includes('c'),
                        authentication: fields[11].includes('a'),
                    },
                    primaryCapabilities: {
                        encrypt: fields[11].includes('E'),
                        sign: fields[11].includes('S'),
                        certify: fields[11].includes('C'),
                        authentication: fields[11].includes('A'),
                    },
                    subkeys: [],
                    userIDs: [],
                }
                break;
            case 'ssb':
            case 'sub':
                if (
                    !currentKey ||
                    (currentKey.private && fields[0] !== 'ssb') ||
                    (!currentKey.private && fields[0] !== 'sub')
                ) throw new Error('Parse ssb/sub failed');
                currentKey.subkeys.push({
                    validity: {
                        i: GnuPG.KeyValidity.Invalid,
                        r: GnuPG.KeyValidity.Revoked,
                        e: GnuPG.KeyValidity.Expired,
                        n: GnuPG.KeyValidity.Never,
                        m: GnuPG.KeyValidity.Marginal,
                        f: GnuPG.KeyValidity.Full,
                        u: GnuPG.KeyValidity.Ultimate,
                    }[fields[1]] || GnuPG.KeyValidity.Unknown,
                    algorithm: parseInt(fields[3]),
                    curve: fields[16],
                    keyLength: parseInt(fields[2]),
                    keyID: fields[4],
                    creationDate: parseInt(fields[5]),
                    expirationDate: fields[6] ? parseInt(fields[6]) : undefined,
                    capabilities: {
                        encrypt: fields[11].includes('e'),
                        sign: fields[11].includes('s'),
                        certify: fields[11].includes('c'),
                        authentication: fields[11].includes('a'),
                    },
                });
                break;
            case 'uid':
                if (!currentKey) throw new Error('Parse uid failed');
                // https://github.com/openpgpjs/openpgpjs/blob/b2bd8a0fdd12902484d65baa4ae4eb7f146fcd32/src/packet/userid.js#L75
                const userID: { name?: string, email: string } = {
                    name: undefined,
                    email: '',
                };
                const m = /^(?<name>[^()]+\s+)?(?<comment>\([^()]+\)\s+)?(?<email><\S+@\S+>)$/.exec(fields[9]);
                if (m !== null) {
                    const { name, email } = m.groups!;
                    userID.name = name?.trim() || '';
                    userID.email = email.substring(1, email.length - 1);
                } else if (/^[^\s@]+@[^\s@]+$/.test(fields[9])) {
                    userID.email = fields[9];
                } else {
                    userID.name = fields[9];
                }
                currentKey.userIDs.push(userID);
                break;
        }
    }

    if (currentKey) keys.push(currentKey);
    return keys;
};

const addKeys = (keys: GnuPG.KeyInfo[]) => {
    // const unixNow = Date.now() / 1e3;
    for (const key of keys) {
        // if (
        //     key.expirationDate < unixNow ||
        //     key.validity < GnuPG.KeyValidity.Marginal ||
        //     !key.capabilities.encrypt
        // ) continue;
        keychain.set(key.keyID, key);
        // @ts-expect-error
        (key.private ? privateSubkeys : publicSubkeys).set(key.keyID, key)
        // @ts-expect-error
        key.subkeys.forEach(subkey => (key.private ? privateSubkeys : publicSubkeys).set(subkey.keyID, key));
    }
};

const loadKeychain = async () => {
    keychain.clear();
    privateSubkeys.clear();
    publicSubkeys.clear();
    keyBindings.clear();
    signKey = null;

    const config = LiteLoader.api.config.get('PGP_Encryption', defaultConfig);

    try {
        const gpgExportPublicOutput: { stdout: string, stderr: string } = await new Promise((resolve, reject) => childProcess.execFile(
            'gpg',
            ['--list-keys', '--with-colons'],
            { timeout: 30000 },
            (error, stdout, stderr) => error ? reject(stderr || error) : resolve({ stdout, stderr })
        ));
        addKeys(parseColonKeyList(gpgExportPublicOutput.stdout));
    } catch (err) {
        log('GnuPG export public key error', err);
    }
    try {
        const gpgExportPrivateOutput: { stdout: string, stderr: string } = await new Promise((resolve, reject) => childProcess.execFile(
            'gpg',
            ['--list-secret-keys', '--with-colons'],
            { timeout: 30000 },
            (error, stdout, stderr) => error ? reject(stderr || error) : resolve({ stdout, stderr })
        ));
        addKeys(parseColonKeyList(gpgExportPrivateOutput.stdout));
    } catch (err) {
        log('GnuPG export private key error', err);
    }

    for (const kb of config.keyBinding) {
        if (kb.uin <= 0 || !publicSubkeys.has(kb.keyID)) continue;
        if (!keyBindings.has(kb.uin)) keyBindings.set(kb.uin, []);
        keyBindings.get(kb.uin)!.push(publicSubkeys.get(kb.keyID)!);
    }
    if (config.signKeyID && privateSubkeys.has(config.signKeyID)) {
        signKey = privateSubkeys.get(config.signKeyID)!;
    }
};

loadKeychain();

ipcMain.handle('PGP_Encryption.loadKeychain', async (_) => {
    await loadKeychain();
});

ipcMain.handle('PGP_Encryption.handleEncryptedMessage', async (_, armoredMessage: string) => {
    const result: {
        error: Error | null,
        output: string | null,
        data: string | null,
    } = {
        error: null,
        output: null,
        data: null,
    };
    try {
        const gpgDecryptOutput: { stdout: string, stderr: string } = (await decryptResultCache.fetch(armoredMessage))!;
        result.data = gpgDecryptOutput.stdout;
        result.output = gpgDecryptOutput.stderr;
    } catch (err) {
        result.error = (err as Error);
        log(err);
    }
    return result;
});

ipcMain.handle('PGP_Encryption.encryptMessage', async (_, targetKeyIDs: string[], plaintext: string) => {
    const targetKeys = targetKeyIDs.map(e => publicSubkeys.get(e)!);
    const gpgEncryptOutput: { stdout: string, stderr: string } = await new Promise((resolve, reject) => {
        const p = childProcess.execFile(
            'gpg',
            [
                '--armor', '--encrypt',
                ...targetKeys.reduce((a, c) => {
                    a.push('--recipient');
                    a.push(c.keyID);
                    return a;
                }, [] as string[]),
                ...(
                    (signKey && !targetKeys.some(targetKey => signKey!.keyID === targetKey.keyID))
                        ? ['--recipient', signKey.keyID]
                        : []
                ),
                ...(signKey ? ['--sign', '--local-user', signKey.keyID] : []),
            ],
            { timeout: 30000 },
            (error, stdout, stderr) => error ? reject(stderr || error) : resolve({ stdout, stderr })
        );
        p.stdin!.write(plaintext);
        p.stdin!.end();
    });
    return gpgEncryptOutput.stdout.split('\n').map(e => e.trim()).join('\n');
});

ipcMain.handle('PGP_Encryption.getUserIDsByKeyID', async (_, keyID: string) => {
    const key = privateSubkeys.get(keyID) || publicSubkeys.get(keyID) || null;
    return key?.userIDs;
});

ipcMain.handle('PGP_Encryption.getKeychain', async (_) => {
    return Array.from(keychain.values());
});

ipcMain.handle('PGP_Encryption.getConfig', async (_) => {
    return LiteLoader.api.config.get('PGP_Encryption', {
        signKeyID: null,
        keyBinding: [],
    });
});

ipcMain.handle('PGP_Encryption.setSignKeyID', async (_, keyID: string) => {
    const config = LiteLoader.api.config.get('PGP_Encryption', defaultConfig);
    if (privateSubkeys.has(keyID)) {
        signKey = privateSubkeys.get(keyID)!;
        config.signKeyID = keyID;
    } else {
        signKey = null;
        config.signKeyID = null;
    }
    LiteLoader.api.config.set('PGP_Encryption', config);
});

ipcMain.handle('PGP_Encryption.getSignKeyID', async (_) => {
    if (signKey === null) return null;
    return {
        userIDs: signKey.userIDs,
        keyID: signKey.keyID,
    };
});

ipcMain.handle('PGP_Encryption.setKeyBinding', async (_, keyBinding: { uin: number, keyID: string }[]) => {
    const config = LiteLoader.api.config.get('PGP_Encryption', defaultConfig);
    config.keyBinding.length = 0;
    keyBindings.clear();
    for (const kb of keyBinding) {
        if (kb.uin <= 0 || !publicSubkeys.has(kb.keyID)) continue;
        if (!keyBindings.has(kb.uin)) keyBindings.set(kb.uin, []);
        keyBindings.get(kb.uin)!.push(publicSubkeys.get(kb.keyID)!);
        config.keyBinding.push(kb);
    }
    config.keyBinding.sort((a, b) => a.uin !== b.uin ? (a.uin - b.uin) : a.keyID.localeCompare(b.keyID));
    LiteLoader.api.config.set('PGP_Encryption', config);
});

ipcMain.handle('PGP_Encryption.getKeyBindings', async (_, uin: number) => {
    const keys = keyBindings.get(uin);
    if (!keys?.length) return null;
    return keys.map(key => ({
        userIDs: key.userIDs,
        keyID: key.keyID,
    }));
});

ipcMain.handle('PGP_Encryption.clearDecryptResultCache', async (_) => {
    decryptResultCache.clear();
});
