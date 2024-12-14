/// <reference types="vite/client" />

declare namespace PGP_Encryption {
    const handleEncryptedMessage: (armoredMessage: string) => Promise<{
        error: Error?,
        output: string?,
        data: string?,
    }>;
    const encryptMessage: (targetKeyID: string, plaintext: string) => Promise<string>;
    const getUserIDsByKeyID: (keyID: string) => Promise<{ name?: string, email: string }[] | null>;
    const loadKeychain: () => Promise<void>;
    const getKeychain: () => Promise<import('./gnupg.js').default.KeyInfo[]>;
    const getConfig: () => Promise<{
        useSystemGPG: boolean,
        signKeyID: string | null,
        keyBinding: {
            uin: number,
            keyID: string,
        }[],
    }>;
    const setSignKeyID: (keyID: string) => Promise<void>;
    const getSignKeyID: () => Promise<{
        userIDs: {
            name: string,
            email: string,
        }[],
        keyID: string,
    } | null>;
    const setKeyBinding: (keyBinding: { uin: number, keyID: string }[]) => Promise<void>;
    const getKeyBinding: (uin: number) => Promise<{
        userIDs: {
            name: string,
            email: string,
        }[],
        keyID: string,
    } | null>;
}

declare namespace LiteLoader {
    const path: ILiteLoaderPath;
    const versions: ILiteLoaderVersion;
    const os: ILiteLoaderOS;
    const package: ILiteLoaderPackage;
    const config: {
        LiteLoader: {
            disabled_plugins: string[],
        }
    };
    const plugins: Record<string, ILiteLoaderPlugin>;
    const api: ILiteLoaderAPI;

    interface ILiteLoaderPath {
        root: string,
        profile: string,
        data: string,
        plugins: string,
    }

    interface ILiteLoaderVersion {
        qqnt: string,
        liteloader: string,
        node: string,
        chrome: string,
        electron: string,
    }

    interface ILiteLoaderOS {
        platform: 'win32' | 'linux' | 'darwin',
    }

    interface ILiteLoaderPackage {
        liteloader: object,
        qqnt: object,
    }

    interface ILiteLoaderPlugin {
        manifest: {
            manifest_version: 4,
            type: 'extension' | 'theme' | 'framework',
            name: string,
            slug: string,
            description: string,
            version: string,
            icon: string | null,
            thumb: string | null,
            authors: {
                name: string,
                link: string,
            }[],
            dependencies?: string[],
            platform: ('win32' | 'linux' | 'darwin')[],
            injects?: {
                renderer?: string,
                main?: string,
                preload?: string,
            },
            repository?: {
                repo: string,
                branch: string,
                release?: {
                    tag: string,
                    file: string,
                },
            },
        },
        incompatible: boolean,
        disabled: boolean,
        path: ILiteLoaderPluginPath
    }

    interface ILiteLoaderPluginPath {
        plugin: string,
        data: string,
        injects: ILiteLoaderPluginPathInject
    }

    interface ILiteLoaderPluginPathInject {
        main: string,
        renderer: string,
        preload: string,
    }

    interface ILiteLoaderAPI {
        openPath: (path: string) => void,
        openExternal: (url: string) => void,
        disablePlugin: (slug: string) => void,
        config: ILiteLoaderAPIConfig,
    }

    interface ILiteLoaderAPIConfig {
        set: <IConfig = unknown>(slug: string, new_config: IConfig) => unknown,
        get: <IConfig = unknown>(slug: string, default_config?: IConfig) => IConfig,
    }
}