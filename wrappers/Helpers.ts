import sha256 from 'crypto-js/sha256';
import { Address, beginCell } from '@ton/core';

export function sha256Hash(input: string): bigint {
    const hash = sha256(input);
    const hashHex = hash.toString();
    return BigInt('0x' + hashHex);
}

export function bufferToBigInt(x: Buffer) {
    return BigInt('0x' + x.toString('hex'));
}

export function bigIntToBuffer(x: bigint) {
    return Buffer.from(x.toString(16), 'hex');
}

export function getAddressBigInt(hash: bigint): Address {
    return beginCell().storeUint(4, 3).storeUint(0, 8).storeUint(hash, 256).endCell().beginParse().loadAddress();
}

export function unixToFriendly(timestamp: number): string {
    const date = new Date(timestamp * 1000);

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZoneName: 'longOffset',
    };

    const englishLocale = 'en-US';
    options.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleDateString(englishLocale, options)}`;
}
