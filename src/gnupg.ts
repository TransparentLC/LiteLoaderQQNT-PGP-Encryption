// https://datatracker.ietf.org/doc/html/rfc9580#section-9.1
export enum KeyAlgorithm {
    Reserved = 0,
    RSAEncryptSign = 1,
    RSAEncryptOnly = 2,
    RSASignOnly = 3,
    Elgamal = 16,
    DSA = 17,
    ECDH = 18,
    ECDSA = 19,
    EdDSALegacy = 22,
    X25519 = 25,
    X448 = 26,
    Ed25519 = 27,
    Ed448 = 28,
}

// https://github.com/gpg/gnupg/blob/master/doc/DETAILS#field-2---validity
export enum KeyValidity {
    Invalid = -3,
    Revoked = -2,
    Expired = -1,
    Unknown = 0,
    Never,
    Marginal,
    Full,
    Ultimate,
}

export type SubKeyInfo = {
    validity: KeyValidity,
    algorithm: KeyAlgorithm,
    curve: string,
    keyLength: number,
    keyID: string,
    creationDate: number,
    expirationDate?: number,
    capabilities: {
        sign: boolean,
        certify: boolean,
        encrypt: boolean,
        authentication: boolean,
    },
};

export type KeyInfo = SubKeyInfo & {
    private: boolean,
    userIDs: {
        name?: string,
        email: string,
    }[],
    primaryCapabilities: {
        encrypt: boolean,
        sign: boolean,
        certify: boolean,
        authentication: boolean,
    },
    subkeys: SubKeyInfo[],
};

export type PublicKeyInfo = KeyInfo & { private: false };
export type PrivateKeyInfo = KeyInfo & { private: true };
