import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('PGP_Encryption', {
    handleEncryptedMessage: (armoredMessage: string) => ipcRenderer.invoke('PGP_Encryption.handleEncryptedMessage', armoredMessage),
    encryptMessage: (targetKeyIDs: string, plaintext: string) => ipcRenderer.invoke('PGP_Encryption.encryptMessage', targetKeyIDs, plaintext),
    getUserIDsByKeyID: (keyID: string) => ipcRenderer.invoke('PGP_Encryption.getUserIDsByKeyID', keyID),
    loadKeychain: () => ipcRenderer.invoke('PGP_Encryption.loadKeychain'),
    getKeychain: () => ipcRenderer.invoke('PGP_Encryption.getKeychain'),
    getConfig: () => ipcRenderer.invoke('PGP_Encryption.getConfig'),
    setSignKeyID: (keyID: string) => ipcRenderer.invoke('PGP_Encryption.setSignKeyID', keyID),
    getSignKeyID: () => ipcRenderer.invoke('PGP_Encryption.getSignKeyID'),
    setKeyBinding: (keyBinding: { uin: number, keyID: string }[]) => ipcRenderer.invoke('PGP_Encryption.setKeyBinding', keyBinding),
    getKeyBindings: (uin: number) => ipcRenderer.invoke('PGP_Encryption.getKeyBindings', uin),
    clearDecryptResultCache: () => ipcRenderer.invoke('PGP_Encryption.clearDecryptResultCache'),
});