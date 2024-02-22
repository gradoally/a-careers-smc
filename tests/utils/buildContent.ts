import { beginCell, Builder, Cell, Dictionary, Slice } from '@ton/core';
import { sha256Hash } from '../../wrappers/Helpers';

export type AdminData = {
    category: string;
    canApproveUser: boolean;
    canRevokeUser: boolean;
    nickname: string;
    about: string;
    website: string;
    portfolio: string;
    resume: string;
    specialization: string;
};

export type UserData = {
    isUser: boolean;
    isFreelancer: boolean;
    nickname: string;
    telegram: string;
    about: string;
    website: string;
    portfolio: string;
    resume: string;
    specialization: string;
    language: string;
};

export type OrderData = {
    category: string;
    language: string;
    name: string;
    price: bigint;
    deadline: number;
    description: string;
    technicalTask: string;
};

export type ResponseData = {
    text: string;
    price: bigint;
    deadline: number;
};

export function buildAdminContent(data: AdminData): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('category'), beginCell().storeUint(sha256Hash(data.category), 256).endCell());
    content.set(sha256Hash('can_approve_user'), beginCell().storeBit(data.canApproveUser).endCell());
    content.set(sha256Hash('can_revoke_user'), beginCell().storeBit(data.canRevokeUser).endCell());
    content.set(sha256Hash('nickname'), beginCell().storeStringTail(data.nickname).endCell());
    content.set(sha256Hash('about'), beginCell().storeStringTail(data.about).endCell());
    content.set(sha256Hash('website'), beginCell().storeStringTail(data.website).endCell());
    content.set(sha256Hash('portfolio'), beginCell().storeStringTail(data.portfolio).endCell());
    content.set(sha256Hash('resume'), beginCell().storeStringTail(data.resume).endCell());
    content.set(sha256Hash('specialization'), beginCell().storeStringTail(data.specialization).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}

export function buildUserContent(data: UserData): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('is_user'), beginCell().storeBit(data.isUser).endCell());
    content.set(sha256Hash('is_freelancer'), beginCell().storeBit(data.isFreelancer).endCell());
    content.set(sha256Hash('nickname'), beginCell().storeStringTail(data.nickname).endCell());
    content.set(sha256Hash('telegram'), beginCell().storeStringTail(data.telegram).endCell());
    content.set(sha256Hash('about'), beginCell().storeStringTail(data.about).endCell());
    content.set(sha256Hash('website'), beginCell().storeStringTail(data.website).endCell());
    content.set(sha256Hash('portfolio'), beginCell().storeStringTail(data.portfolio).endCell());
    content.set(sha256Hash('resume'), beginCell().storeStringTail(data.resume).endCell());
    content.set(sha256Hash('specialization'), beginCell().storeStringTail(data.specialization).endCell());
    content.set(sha256Hash('language'), beginCell().storeUint(sha256Hash(data.language), 256).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}

export function buildOrderContent(data: OrderData): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('category'), beginCell().storeUint(sha256Hash(data.category), 256).endCell());
    content.set(sha256Hash('language'), beginCell().storeUint(sha256Hash(data.language), 256).endCell());
    content.set(sha256Hash('name'), beginCell().storeStringTail(data.name).endCell());
    content.set(sha256Hash('price'), beginCell().storeCoins(data.price).endCell());
    content.set(sha256Hash('deadline'), beginCell().storeUint(data.deadline, 32).endCell());
    content.set(sha256Hash('description'), beginCell().storeStringTail(data.description).endCell());
    content.set(sha256Hash('technical_task'), beginCell().storeStringTail(data.technicalTask).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}

export function buildResponseContent(data: ResponseData): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('text'), beginCell().storeStringTail(data.text).endCell());
    content.set(sha256Hash('price'), beginCell().storeCoins(data.price).endCell());
    content.set(sha256Hash('deadline'), beginCell().storeUint(data.deadline, 32).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}
