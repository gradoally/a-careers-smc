import { NetworkProvider } from '@ton/blueprint';
import {
    AdminData,
    buildAdminContent,
    buildOrderContent,
    buildResponseContent,
    buildUserContent,
    ResponseData,
} from '../tests/utils/buildContent';
import { beginCell, toNano } from '@ton/core';

enum Operations {
    'build content for admin' = 1,
    'build content for user',
    'build content for order',
    'build content for response',
    'build content for result'
}

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const operation = await ui.choose('Operation:', ['1', '2', '3', '4', '5'], (v: string) => Operations[parseInt(v)]);
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
        case 5:
            await buildContentForResult(provider);
            break;
    }
}

async function buildContentForAdmin(provider: NetworkProvider) {
    const ui = provider.ui();
    const category = await ui.input('Category:');
    const canApproveUser = await ui.prompt('Can approve user:');
    const canRevokeUser = await ui.prompt('Can revoke user:');
    const nickname = await ui.input('Nickname:');
    const about = await ui.input('About:');
    const website = await ui.input('Website:');
    const portfolio = await ui.input('Portfolio:');
    const resume = await ui.input('Resume:');
    const specialization = await ui.input('Specialization:');

    const data: AdminData = {
        category,
        canApproveUser,
        canRevokeUser,
        nickname,
        about,
        website,
        portfolio,
        resume,
        specialization,
    };

    const content = buildAdminContent(data);
    ui.write(content.toBoc().toString('hex'));
}

async function buildContentForUser(provider: NetworkProvider) {
    const ui = provider.ui();
    const isUser = await ui.prompt('Is user:');
    const isFreelancer = await ui.prompt('Is freelancer:');
    const nickname = await ui.input('Nickname:');
    const telegram = await ui.input('Telegram:');
    const about = await ui.input('About:');
    const website = await ui.input('Website:');
    const portfolio = await ui.input('Portfolio:');
    const resume = await ui.input('Resume:');
    const specialization = await ui.input('Specialization:');
    const language = await ui.input('Language:');

    const content = buildUserContent({
        isUser,
        isFreelancer,
        nickname,
        telegram,
        about,
        website,
        portfolio,
        resume,
        specialization,
        language,
    });
    ui.write(content.toBoc().toString('hex'));
}

async function buildContentForOrder(provider: NetworkProvider) {
    const ui = provider.ui();
    const category = await ui.input('Category:');
    const language = await ui.input('Language:');
    const name = await ui.input('Name:');
    const price = toNano(await ui.input('Price:'));
    const deadline = parseInt(await ui.input('Deadline:'));
    const description = await ui.input('Description:');
    const technicalTask = await ui.input('Technical task:');

    const content = buildOrderContent({
        category,
        language,
        name,
        price,
        deadline,
        description,
        technicalTask,
    });
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

async function buildContentForResult(provider: NetworkProvider) {
    const ui = provider.ui();
    const text = await ui.input('Result text:');
    const content = beginCell().storeStringTail(text).endCell();
    ui.write(content.toBoc().toString('hex'));
}
