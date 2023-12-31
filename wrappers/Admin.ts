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

export type AdminConfig = {};

export type AdminData = {
    init: boolean;
    index: number;
    masterAddress: Address;
    adminAddress: Address;
    revokedAt: number;
    content: Dictionary<bigint, Cell>;
};

export function adminConfigToCell(config: AdminConfig): Cell {
    return beginCell().endCell();
}

export class Admin implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Admin(address);
    }

    static createFromConfig(config: AdminConfig, code: Cell, workchain = 0) {
        const data = adminConfigToCell(config);
        const init = { code, data };
        return new Admin(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateAdmin(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        content: Cell,
        adminAddress: Address,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CREATE_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeMaybeRef(content)
                .storeAddress(adminAddress)
                .endCell(),
        });
    }

    async sendActivateUser(provider: ContractProvider, via: Sender, value: bigint, queryID: number, userIndex: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.ACTIVATE_USER_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeUint(userIndex, 64)
                .endCell(),
        });
    }

    async sendActivateOrder(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        orderIndex: number,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.ACTIVATE_ORDER_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeUint(orderIndex, 64)
                .endCell(),
        });
    }

    async sendProcessArbitration(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        orderIndex: number,
        customerPart: number,
        freelancerPart: number,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.PROCESS_ARBITRATION_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeUint(orderIndex, 64)
                .storeUint(customerPart, 8)
                .storeUint(freelancerPart, 8)
                .endCell(),
        });
    }

    async sendRevokeAdmin(provider: ContractProvider, via: Sender, value: bigint, queryID: number, adminIndex: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.REVOKE_ADMIN_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeUint(adminIndex, 64)
                .endCell(),
        });
    }

    async sendRevokeUser(provider: ContractProvider, via: Sender, value: bigint, queryID: number, userIndex: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.REVOKE_USER_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeUint(userIndex, 64)
                .endCell(),
        });
    }

    async getAdminData(provider: ContractProvider): Promise<AdminData> {
        const result = await provider.get('get_admin_data', []);

        return {
            init: result.stack.readBoolean(),
            index: result.stack.readNumber(),
            masterAddress: result.stack.readAddress(),
            adminAddress: result.stack.readAddress(),
            revokedAt: result.stack.readNumber(),
            content: result.stack
                .readCell()
                .beginParse()
                .loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()),
        };
    }
}
