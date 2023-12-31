import { NetworkProvider } from '@ton/blueprint';
import {
    AdminData,
    buildAdminContent,
    buildOrderContent,
    buildResponseContent,
    buildUserContent,
    ResponseData,
} from '../tests/utils/buildContent';
import { toNano } from '@ton/core';

enum Operations {
    'build content for admin' = 1,
    'build content for user',
    'build content for order',
    'build content for response',
}

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const operation = await ui.choose('Operation:', ['1', '2', '3', '4'], (v: string) => Operations[parseInt(v)]);
    switch (parseInt(operation)) {
        case 1:
            await buildContentForAdmin(provider);
            break;
        case 2:
            await buildContentForUser(provider);
            break;
        case 3:
            await buildContentForOrder(provider);
            break;
        case 4:
            await buildContentForResponse(provider);
            break;
    }
}

/*
export type AdminData = {
    category: string;
    canApproveUser: boolean;
    canRevokeUser: boolean;
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

export function buildResponseContent(data: ResponseData): Cell {
    const content = Dictionary.empty<bigint, Cell>();
    content.set(sha256Hash('text'), beginCell().storeStringTail(data.text).endCell());
    content.set(sha256Hash('price'), beginCell().storeCoins(data.price).endCell());
    content.set(sha256Hash('deadline'), beginCell().storeUint(data.deadline, 32).endCell());

    return beginCell().storeDictDirect(content, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell();
}

 */

async function buildContentForAdmin(provider: NetworkProvider) {
    const ui = provider.ui();
    const category = await ui.input('Category:');
    const canApproveUser = await ui.prompt('Can approve user:');
    const canRevokeUser = await ui.prompt('Can revoke user:');
    const data: AdminData = {
        category,
        canApproveUser,
        canRevokeUser,
    };

    const content = buildAdminContent(data);
    ui.write(content.toBoc().toString('hex'));
}

async function buildContentForUser(provider: NetworkProvider) {
    const ui = provider.ui();
    const isUser = await ui.prompt('Is user:');
    const isFreelancer = await ui.prompt('Is freelancer:');

    const content = buildUserContent(isUser, isFreelancer);
    ui.write(content.toBoc().toString('hex'));
}

async function buildContentForOrder(provider: NetworkProvider) {
    const ui = provider.ui();
    const category = await ui.input('Category:');

    const content = buildOrderContent(category);
    ui.write(content.toBoc().toString('hex'));
}

async function buildContentForResponse(provider: NetworkProvider) {
    const ui = provider.ui();
    const text = await ui.input('Text:');
    const price = toNano(await ui.input('Price:'));
    const deadline = parseInt(await ui.input('Deadline:'));
    const data: ResponseData = {
        text,
        price,
        deadline,
    };

    const content = buildResponseContent(data);
    ui.write(content.toBoc().toString('hex'));
}
