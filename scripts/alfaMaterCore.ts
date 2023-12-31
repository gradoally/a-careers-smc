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
