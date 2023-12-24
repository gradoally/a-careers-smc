import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
} from '@ton/core';
import { OPCODES } from './Config';

export type UserConfig = {};

export type UserData = {
    init: boolean;
    index: number;
    masterAddress: Address;
    userAddress: Address;
    revokedAt: number;
    content: Dictionary<bigint, Cell>;
};

export function userConfigToCell(config: UserConfig): Cell {
    return beginCell().endCell();
}

export class User implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new User(address);
    }

    static createFromConfig(config: UserConfig, code: Cell, workchain = 0) {
        const data = userConfigToCell(config);
        const init = { code, data };
        return new User(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateOrder(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        content: Cell,
        price: bigint,
        deadline: number,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CREATE_ORDER, 32)
                .storeUint(queryID, 64)
                .storeMaybeRef(content)
                .storeCoins(price)
                .storeUint(deadline, 32)
                .endCell(),
        });
    }

    async sendAddResponse(provider: ContractProvider, via: Sender, value: bigint, queryID: number, orderIndex: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.ADD_RESPONSE_USER, 32)
                .storeUint(queryID, 64)
                .storeUint(orderIndex, 64)
                .endCell(),
        });
    }

    async getUserData(provider: ContractProvider): Promise<UserData> {
        const result = await provider.get('get_user_data', []);

        return {
            init: result.stack.readBoolean(),
            index: result.stack.readNumber(),
            masterAddress: result.stack.readAddress(),
            userAddress: result.stack.readAddress(),
            revokedAt: result.stack.readNumber(),
            content: result.stack
                .readCell()
                .beginParse()
                .loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()),
        };
    }
}
