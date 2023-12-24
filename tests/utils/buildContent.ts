import { beginCell, Builder, Cell, Dictionary, Slice } from '@ton/core';
import { sha256Hash } from './helpers';

export function buildAdminContent(category: string): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('category'), beginCell().storeUint(sha256Hash(category), 256).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}

export function buildUserContent(isUser: boolean, isFreelancer: boolean): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('is_user'), beginCell().storeBit(isUser).endCell());
    content.set(sha256Hash('is_freelancer'), beginCell().storeBit(isFreelancer).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}

export function buildOrderContent(category: string): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('category'), beginCell().storeUint(sha256Hash(category), 256).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}
