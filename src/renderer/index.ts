import { createApp, nextTick } from 'petite-vue';
import * as GnuPG from '../gnupg.js';
import manifest from '../../manifest.json';
import setting from './setting.html?raw';

const log = (...data) => console.log('\x1b[92mPGP-Encryption\x1b[39m', ...data);
const dp = new DOMParser;

const formatUserIDs = (userIDs: { name: string, email: string }[]) => userIDs.map(e => `${e.name} <${e.email}>`).join(', ');
const formatKeyID = (keyID: string) => keyID.toUpperCase().match(/[\dA-F]{1,4}/g)!.join(' ');
const formatKeyAlgorithm = (algorithm: GnuPG.KeyAlgorithm) => Object.keys(GnuPG.KeyAlgorithm)[Object.values(GnuPG.KeyAlgorithm).indexOf(algorithm)] || `KeyAlgorithm #${algorithm}`;
const formatKeyExtraInfo = (key: GnuPG.SubKeyInfo) => [
    `信任等级：${{
        [GnuPG.KeyValidity.Revoked]: '已吊销',
        [GnuPG.KeyValidity.Expired]: '已过期',
        [GnuPG.KeyValidity.Unknown]: '未知',
        [GnuPG.KeyValidity.Never]: '永不信任',
        [GnuPG.KeyValidity.Marginal]: '勉强信任',
        [GnuPG.KeyValidity.Full]: '完全信任',
        [GnuPG.KeyValidity.Ultimate]: '绝对信任',
    }[key.validity]}`,
    `创建时间：${new Date(key.creationDate * 1e3).toISOString()}`,
    `过期时间：${key.expirationDate ? new Date(key.expirationDate * 1e3).toISOString() : '永不过期'}`,
    `密钥用途：${[
        ['sign', '签名（Sign）'],
        ['certify', '认证（Certify）'],
        ['encrypt', '加密（Encrypt）'],
        ['authentication', '身份验证（Authenticate）'],
    ].filter(([k, _]) => key.capabilities[k]).map(([_, v]) => v).join('、')}`,
].join('\n');
const pollingQuerySelector = async (element: Element | Document, selector: string, timeout: number = 5000) => {
    const stop = Date.now() + timeout;
    do {
        const el = element.querySelector(selector);
        if (el) return el;
        await new Promise(r => setTimeout(r, 200));
    } while (Date.now() < stop);
    return null;
};

// FIXME: 是否有更好的检测方法？Issue #1的正则表达式可能会出现无限递归
const isPGPMessage = (text: string) => {
    return text.match(/^-----BEGIN PGP MESSAGE-----\s*\n/) && text.match(/-----END PGP MESSAGE-----\s*$/);
};

// https://github.com/ckeditor/ckeditor5-clipboard/blob/master/src/utils/viewtoplaintext.js
const viewToPlainText = (viewItem: any) => {
    let text = '';

    if ( viewItem.is( 'text' ) || viewItem.is( 'textProxy' ) ) {
        // If item is `Text` or `TextProxy` simple take its text data.
        text = viewItem.data;
    } else if ( viewItem.is( 'img' ) && viewItem.hasAttribute( 'alt' ) ) {
        // Special case for images - use alt attribute if it is provided.
        text = viewItem.getAttribute( 'alt' );
    } else {
        // Other elements are document fragments, attribute elements or container elements.
        // They don't have their own text value, so convert their children.
        let prev: any = null;

        for ( const child of viewItem.getChildren() ) {
            const childText = viewToPlainText( child );
            // Separate container element children with one or more new-line characters.
            if ((prev && (prev.is('containerElement') || child.is('containerElement')))) {
                text += '\n';
            }
            text += childText;
            if (child.name === 'br') {
                text += '\n';
            }
            prev = child;
        }
    }

    return text;
};

export const onSettingWindowCreated = async (view: HTMLElement) => {
    dp.parseFromString(setting, 'text/html').body.childNodes.forEach(e => view.appendChild(e));
    createApp({
        manifest: Object.freeze(manifest),
        keychain: [],
        signKeyID: null,
        keyBinding: [],
        keyBindingInput: { uin: '', keyID: null },
        formatUserIDs,
        formatKeyID,
        formatKeyAlgorithm,
        formatKeyExtraInfo,
        log,
        async setSignKey(keyID: string | null) {
            this.signKeyID = keyID;
            log('Set sign key ID', this.signKeyID);
            await PGP_Encryption.setSignKeyID(this.signKeyID);
        },
        addKeyBinding() {
            const uin = parseInt(this.keyBindingInput.uin);
            const keyID = this.keyBindingInput.keyID;
            if (uin > 0 && !this.keyBinding.some(e => e.uin === uin && e.keyID === keyID)) {
                this.keyBinding.push({ uin, keyID });
            }
        },
        async saveKeyBinding() {
            log('Save key binding', this.keyBinding);
            await PGP_Encryption.setKeyBinding(this.keyBinding.map(e => Object.assign({}, e)));
        },
        openRepository() {
            LiteLoader.api.openExternal(`https://github.com/${manifest.repository.repo}`);
        },
        async clearDecryptResultCache() {
            await PGP_Encryption.clearDecryptResultCache();
        },
        async load() {
            await PGP_Encryption.loadKeychain();
            this.keychain.length = 0;
            this.keychain.push(...(await PGP_Encryption.getKeychain()));
            log('Get keychain', this.keychain);
            const config = await PGP_Encryption.getConfig();
            log('Get config', config);
            this.signKeyID = config.signKeyID;
            this.keyBinding.length = 0;
            this.keyBinding.push(...config.keyBinding.filter(e => this.keychain.some(t => t.keyID === e.keyID)));
            nextTick(async () => {
                const selectSignKey = view.querySelector('#pgp-select-signkey')!;
                const selectSignKeySelected = Array.from(selectSignKey.children).find(e => e.getAttribute('data-value') === this.signKeyID);
                if (selectSignKeySelected) {
                    selectSignKeySelected.setAttribute('is-selected', '');
                } else {
                    log('Sign key ID invalid', this.signKeyID);
                    selectSignKey.children[0].setAttribute('is-selected', '');
                    await this.setSignKey(this.signKeyID = null);
                }
            });
        },
        async mounted() {
            nextTick(() => {
                // @ts-expect-error "selected"不是标准事件名称
                (view.querySelector('#pgp-select-signkey'))!.addEventListener(
                    'selected',
                    (e: { detail: { name: string, value: string }}) => this.setSignKey(e.detail.value || null),
                );
                // @ts-expect-error "selected"不是标准事件名称
                (view.querySelector('#pgp-select-bindkey'))!.addEventListener(
                    'selected',
                    (e: { detail: { name: string, value: string }}) => this.keyBindingInput.keyID = e.detail.value,
                );
            });
            await this.load();
            // @ts-ignore
            // view.pgpapp = this;
        },
    }).mount(view);
};

/*
<div class="ml-item">
    <div class="message">
        <div class="message-container">
            <div class="message-content__wrapper">
                <div class="msg-content-container"> // 消息气泡
                    <div class="msg-content">
                        <span class="text-element">...</span> // 消息内容 textElement

                        // 以下是插件添加的
                        <span class="text-element">...</span> // 解密内容 decryptedElement
                        <hr>
                        <small><span>🔒🔐🔓</span> PGP 加密消息</small> // 加密消息信息 infoElement
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
*/
const handlePGPMessageElement = async (textElement: HTMLSpanElement) => {
    log('Handle PGP message', textElement.innerText);

    // We are switching to system fonts on May 10, 2021 - Meta Stack Exchange
    // https://meta.stackexchange.com/questions/364048
    textElement.style.fontFamily = 'ui-monospace,"Cascadia Mono","Segoe UI Mono","Liberation Mono",Menlo,Monaco,Consolas,monospace';

    const infoElement = document.createElement('small');
    const infoElementLockIcon = document.createElement('span');
    infoElementLockIcon.style.cursor = 'pointer';
    infoElement.appendChild(infoElementLockIcon);
    infoElement.appendChild(document.createTextNode(' '));
    infoElement.appendChild(document.createTextNode('PGP 加密消息'));

    const decryptedElement = document.createElement('span');
    decryptedElement.classList.add('text-element');
    textElement.insertAdjacentElement('afterend', decryptedElement);
    decryptedElement.insertAdjacentElement('afterend', infoElement);
    decryptedElement.insertAdjacentElement('afterend', document.createElement('hr'));
    decryptedElement.style.display = 'none';

    const result = await PGP_Encryption.handleEncryptedMessage(textElement.innerText);

    let showDecrypted = false;
    const toggleDecrypted = () => {
        showDecrypted = !showDecrypted;
        if (showDecrypted) {
            textElement.style.display = 'none';
            decryptedElement.style.display = '';
        } else {
            textElement.style.display = '';
            decryptedElement.style.display = 'none';
        }
        if (result.error) {
            infoElementLockIcon.innerText = '❌';
        } else {
            infoElementLockIcon.innerText = showDecrypted ? '🔓' : '🔒';
        }
    };
    infoElementLockIcon.onclick = toggleDecrypted;
    toggleDecrypted();

    if (result.error) {
        decryptedElement.style.whiteSpace = 'pre-line';
        decryptedElement.appendChild(document.createTextNode(result.error.toString()));
    } else {
        infoElement.style.cursor = 'help';
        infoElement.title = result.output!;
        const el = document.createElement('span');
        el.classList.add('text-normal')
        el.innerText = result.data!;
        decryptedElement.appendChild(el);
    }
};

(() => {
    const activatePlugin = async () => {
        log('location.hash', location.hash);
        if (
            location.hash !== '#/chat' && // 独立的聊天窗口
            location.hash !== '#/main/message' && // 与联系人列表合并在一起的聊天窗口
            location.hash !== '#/record' && // 消息记录
            !location.hash.startsWith('#/forward/') // 合并转发
        ) return;
        log('Plugin activated');

        // 解密消息相关
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                const nodes = Array.from(mutation.addedNodes);
                for (const node of nodes) {
                    if (node.nodeName !== 'DIV') continue;
                    const messages = Array.from((node as HTMLDivElement).querySelectorAll('.message'));
                    for (const message of messages) {
                        const textElement: HTMLSpanElement | null = message.querySelector('.message-content .text-element');
                        if (textElement && isPGPMessage(textElement.innerText)) handlePGPMessageElement(textElement);
                    }
                }
            }
        });
        observer.observe(document.body, {
            subtree: true,
            childList: true,
        });

        if (location.hash === '#/chat' || location.hash === '#/main/message') {
            // 加密消息相关
            let signKey: {
                userIDs: {
                    name: string;
                    email: string;
                }[];
                keyID: string;
            } | null = null;
            let targetKeys: {
                userIDs: {
                    name: string;
                    email: string;
                }[];
                keyID: string;
            }[] | null = null;
            let uin: number | null = null;

            // FIXME: 使用各种方式hook而不是轮询，Object.defineProperty似乎不太管用
            setInterval(async () => {
                // https://github.com/xiyuesaves/LiteLoaderQQNT-lite_tools/blob/v4/src/render_modules/curAioData.js
                const curAioData: {
                    chatType: 0 | 1 | 2, // 什么也没有、私聊、群聊
                    independent?: 2,
                    header: {
                        memberName?: string,
                        peerName?: string | null,
                        remark?: string,
                        uid: string,
                        uin?: string, // QQ号或群号
                        unreadCnt?: number,
                        showMiniDetail?: any,
                    },
                } | null = (window as any).app?.__vue_app__?.config?.globalProperties?.$store?.state?.common_Aio?.curAioData;
                const uinnew = parseInt(curAioData?.header?.uin!) || null;
                if (uinnew === uin) return;
                uin = uinnew;
                log('uin change', uin);

                const operationElement = (await pollingQuerySelector(document, '.chat-input-area .operation', 3000) as HTMLDivElement | null);
                if (operationElement) {
                    let statusElement: HTMLElement | null = operationElement.querySelector('.pgp-status');
                    if (!statusElement) {
                        log('Init status element');
                        const growElement = document.createElement('div');
                        growElement.style.flexGrow = '1';
                        statusElement = document.createElement('small');
                        statusElement.classList.add('pgp-status');
                        statusElement.style.cursor = 'help';
                        statusElement.style.display = 'none';
                        statusElement.innerText = '🔐 PGP 加密可用';
                        operationElement.insertAdjacentElement('afterbegin', growElement);
                        operationElement.insertAdjacentElement('afterbegin', statusElement);
                    }
                    if (curAioData?.header.uin) {
                        signKey = await PGP_Encryption.getSignKeyID();
                        log('signKey', signKey);
                        targetKeys = await PGP_Encryption.getKeyBindings(parseInt(curAioData.header.uin));
                        log('targetKey', parseInt(curAioData.header.uin), targetKeys);
                    }
                    if (targetKeys?.length) {
                        statusElement.style.display = '';
                        statusElement.title = [
                            '按 Ctrl + / 键加密当前输入的消息',
                            ...(signKey ? [
                                '签名密钥：',
                                `${formatUserIDs(signKey.userIDs)} (${formatKeyID(signKey.keyID)})`,
                            ] : []),
                            '加密密钥：',
                            ...((signKey && !targetKeys.some(targetKey => signKey!.keyID === targetKey.keyID)) ? [`${formatUserIDs(signKey.userIDs)} (${formatKeyID(signKey.keyID)})`] : []),
                            ...targetKeys.map(targetKey => `${formatUserIDs(targetKey.userIDs)} (${formatKeyID(targetKey.keyID)})`),
                        ].join('\n');
                    } else {
                        statusElement.style.display = 'none';
                        statusElement.title = '';
                    }

                    const editorElement: HTMLDivElement | null = document.querySelector('.ck.ck-content.ck-editor__editable');
                    if (editorElement && !(editorElement as any).pgpEditorInited) {
                        log('Init editor element');
                        (editorElement as any).pgpEditorInited = true;
                        // https://github.com/PRO-2684/Scriptio-user-scripts/blob/main/pangu.js
                        editorElement.addEventListener('keyup', async e => {
                            if (
                                e.isComposing ||
                                e.keyCode === 229 ||
                                !(e.ctrlKey && e.key === '/') ||
                                !targetKeys?.length
                            ) return;
                            const editorInstance = (editorElement as any).ckeditorInstance;
                            const plaintext = viewToPlainText(editorInstance.editing.view.document.getRoot());
                            log('Encrypt plaintext', plaintext);
                            try {
                                const encrypted = await PGP_Encryption.encryptMessage(targetKeys.map(targetKey => targetKey.keyID), plaintext);
                                editorInstance.setData(encrypted.trim().split('\n').join('<br>'));
                            } catch (err) {
                                editorInstance.setData((err as Error).toString().trim().split('\n').join('<br>'));
                            }
                        });
                    }
                }
            }, 200);
        }
    };

    // https://github.com/xiyuesaves/LiteLoaderQQNT-lite_tools/blob/v4/src/renderer.js
    if (location.hash === '#/blank') {
        // @ts-expect-error "navigatesuccess"不是标准事件名称
        navigation.addEventListener('navigatesuccess', activatePlugin, { once: true });
    } else {
        activatePlugin();
    }
})();
