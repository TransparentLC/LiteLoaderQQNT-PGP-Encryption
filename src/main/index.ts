import fs from 'node:fs';
import path from 'node:path';
import { ipcMain } from 'electron';
import * as openpgp from 'openpgp';

openpgp.config.preferredCompressionAlgorithm = openpgp.enums.compression.zlib;

const log = (...data) => console.log('\x1b[92mPGP-Encryption\x1b[39m', ...data);
const defaultConfig: {
    signKeyID: string | null,
    keyBinding: { uin: number, keyID: string }[],
} = {
    signKeyID: null,
    keyBinding: [],
};

const keychain: Map<string, openpgp.PrivateKey | openpgp.PublicKey> = new Map;
const privateSubkeys: Map<string, openpgp.PrivateKey> = new Map;
const publicSubkeys: Map<string, openpgp.PublicKey> = new Map;
const keyBindings: Map<number, openpgp.PublicKey> = new Map;
let signKey: openpgp.PrivateKey | null = null;

const keychainFolder = path.join(LiteLoader.plugins.PGP_Encryption.path.data, 'keychain');

const addKeys = async (armoredKeys: string) => {
    const keys = await openpgp.readKeys({ armoredKeys });
    for (const key of keys) {
        if (key instanceof openpgp.PrivateKey) {
            keychain.set(key.getKeyID().toHex(), key);
            [key, ...key.subkeys].forEach(e => privateSubkeys.set(e.getKeyID().toHex(), key));
            const publicKey = key.toPublic();
            [publicKey, ...publicKey.subkeys].forEach(e => publicSubkeys.set(e.getKeyID().toHex(), publicKey));
        } else if (key instanceof openpgp.PublicKey && !privateSubkeys.has(key.getKeyID().toHex())) {
            keychain.set(key.getKeyID().toHex(), key);
            [key, ...key.subkeys].forEach(e => publicSubkeys.set(e.getKeyID().toHex(), key));
        }
    }
};

const loadKeychain = async () => {
    keychain.clear();
    privateSubkeys.clear();
    publicSubkeys.clear();
    keyBindings.clear();
    signKey = null;
    if (!fs.existsSync(keychainFolder)) {
        await fs.promises.mkdir(keychainFolder, { recursive: true });
    }
    for (const f of await fs.promises.readdir(keychainFolder)) {
        const file = path.join(keychainFolder, f);
        log('Loading key from keychain folder', file);
        const stat = await fs.promises.lstat(file);
        if (stat.isDirectory()) continue;
        const content = await fs.promises.readFile(file, { encoding: 'utf-8' });
        try {
            await addKeys(content);
        } catch (err) {
            log('Failed to load', file, err);
        }
    }
    const config = LiteLoader.api.config.get('PGP_Encryption', defaultConfig);
    for (const kb of config.keyBinding) {
        if (kb.uin <= 0 || !publicSubkeys.has(kb.keyID)) continue;
        keyBindings.set(kb.uin, publicSubkeys.get(kb.keyID)!);
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
        keyIDs: string[],
        signatures: {
            keyID: string,
            verified: boolean,
        }[],
        data: string | null,
    } = {
        error: null,
        keyIDs: [],
        signatures: [],
        data: null,
    };
    try {
        const message = await openpgp.readMessage({ armoredMessage });
        result.keyIDs = message.getEncryptionKeyIDs().map(e => e.toHex());
        for (const keyID of message.getEncryptionKeyIDs()) {
            const key = privateSubkeys.get(keyID.toHex());
            if (key) {
                const decrypted = await openpgp.decrypt({
                    message,
                    decryptionKeys: key,
                    verificationKeys: result.keyIDs.reduce((a, c) => {
                        const key = publicSubkeys.get(c);
                        if (key) a.push(key);
                        return a;
                    }, [] as openpgp.PublicKey[]),
                });
                for (const signature of decrypted.signatures) {
                    result.signatures.push({
                        keyID: signature.keyID.toHex(),
                        verified: await signature.verified.catch(() => false),
                    })
                }
                result.data = decrypted.data as string;
                break;
            }
        }
    } catch (err) {
        result.error = (err as Error);
        log(err);
    }
    return result;
});

ipcMain.handle('PGP_Encryption.encryptMessage', async (_, targetKeyID: string, plaintext: string) => {
    const targetKey = publicSubkeys.get(targetKeyID)!;
    const message = await openpgp.createMessage({ text: plaintext });
    const encrypted = await openpgp.encrypt({
        message,
        encryptionKeys: (signKey && signKey.getKeyID().toHex() !== targetKey.getKeyID().toHex()) ? [signKey, targetKey] : targetKey,
        signingKeys: signKey ?? undefined,
    })
    return encrypted;
});

ipcMain.handle('PGP_Encryption.getUserIDsByKeyID', async (_, keyID: string) => {
    const key = privateSubkeys.get(keyID) || publicSubkeys.get(keyID) || null;
    return key?.users.map(e => ({
        name: e.userID?.name,
        email: e.userID?.email,
    }));
});

ipcMain.handle('PGP_Encryption.getKeychain', async (_) => {
    const result: {
        private: boolean,
        userIDs: {
            name: string,
            email: string,
        }[],
        keyID: string,
        keys: {
            algorithm: string,
            bits?: number,
            curve?: string,
            keyID: string,
        }[],
    }[] = [];
    for (const key of keychain.values()) {
        result.push({
            private: key.isPrivate(),
            userIDs: key.users.map(e => ({
                name: e.userID!.name,
                email: e.userID!.email,
            })),
            keyID: key.getKeyID().toHex(),
            keys: [key, ...key.subkeys].map(e => ({
                ...e.getAlgorithmInfo(),
                keyID: e.getKeyID().toHex(),
            })),
        });
    }
    return result;
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
        userIDs: signKey.users.map(e => ({
            name: e.userID?.name,
            email: e.userID?.email,
        })),
        keyID: signKey.getKeyID().toHex(),
    };
});

ipcMain.handle('PGP_Encryption.setKeyBinding', async (_, keyBinding: { uin: number, keyID: string }[]) => {
    const config = LiteLoader.api.config.get('PGP_Encryption', defaultConfig);
    config.keyBinding.length = 0;
    keyBindings.clear();
    for (const kb of keyBinding) {
        if (kb.uin <= 0 || !publicSubkeys.has(kb.keyID)) continue;
        keyBindings.set(kb.uin, publicSubkeys.get(kb.keyID)!);
        config.keyBinding.push(kb);
    }
    LiteLoader.api.config.set('PGP_Encryption', config);
});

ipcMain.handle('PGP_Encryption.getKeyBinding', async (_, uin: number) => {
    const key = keyBindings.get(uin);
    if (!key) return null;
    return {
        userIDs: key.users.map(e => ({
            name: e.userID?.name,
            email: e.userID?.email,
        })),
        keyID: key.getKeyID().toHex(),
    };
});
