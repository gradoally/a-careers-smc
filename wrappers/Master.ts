import {
    Address,
    beginCell,
    Builder,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    DictionaryValue,
    Sender,
    SendMode,
    Slice,
    toNano,
} from '@ton/core';
import { OPCODES } from './Config';
import { sha256Hash } from './Helpers';

export type MasterConfig = {
    rootAddress: Address;
    address81: Address;
    orderCode: Cell;
    userCode: Cell;
    adminCode: Cell;
    orderFeeNumerator: number;
    orderFeeDenominator: number;
    userCreationFee: bigint;
    orderCreationFee: bigint;
};

export type Indexes = {
    orderNextIndex: number;
    userNextIndex: number;
    adminNextIndex: number;
};

export type Codes = {
    orderCode: Cell;
    userCode: Cell;
    adminCode: Cell;
};

export type CategoryValue = {
    active: boolean;
    adminCount: number;
    activeOrderCount: number;
    agreementPercentage: number;
    adminCountForActive: number;
};

export type MasterData = {
    rootAddress: Address;
    categories: Dictionary<bigint, CategoryValue> | undefined;
    orderFeeNumerator: number;
    orderFeeDenominator: number;
    userCreationFee: bigint;
    orderCreationFee: bigint;
};

export function createCategoryValue(): DictionaryValue<CategoryValue> {
    return {
        serialize(src: CategoryValue, builder: Builder) {
            builder.storeBit(src.active);
            builder.storeUint(src.adminCount, 64);
            builder.storeUint(src.activeOrderCount, 64);
            builder.storeUint(src.agreementPercentage, 64);
            builder.storeUint(src.adminCountForActive, 16);
        },
        parse: (src: Slice) => {
            return {
                active: src.loadBoolean(),
                adminCount: src.loadUint(64),
                activeOrderCount: src.loadUint(64),
                agreementPercentage: src.loadUint(64),
                adminCountForActive: src.loadUint(16),
            };
        },
    };
}

export function masterConfigToCell(config: MasterConfig): Cell {
    const codes = beginCell().storeRef(config.orderCode).storeRef(config.userCode).storeRef(config.adminCode).endCell();

    const indexes = beginCell().storeUint(0, 64).storeUint(0, 64).storeUint(0, 64).endCell();

    return beginCell()
        .storeAddress(config.rootAddress)
        .storeAddress(config.address81)
        .storeRef(codes)
        .storeRef(indexes)
        .storeUint(0, 1)
        .storeUint(config.orderFeeNumerator, 8)
        .storeUint(config.orderFeeDenominator, 8)
        .storeCoins(config.userCreationFee)
        .storeCoins(config.orderCreationFee)
        .endCell();
}

export class Master implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Master(address);
    }

    static createFromConfig(config: MasterConfig, code: Cell, workchain = 0) {
        const data = masterConfigToCell(config);
        const init = { code, data };
        return new Master(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateCategory(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        category: string,
        agreementPercentage: number,
        adminCountForActive: number,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CREATE_CATEGORY, 32)
                .storeUint(queryID, 64)
                .storeUint(sha256Hash(category), 256)
                .storeUint(agreementPercentage, 64)
                .storeUint(adminCountForActive, 16)
                .endCell(),
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

    async sendCreateUser(provider: ContractProvider, via: Sender, value: bigint, queryID: number, content: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CREATE_USER, 32)
                .storeUint(queryID, 64)
                .storeMaybeRef(content)
                .endCell(),
        });
    }

    async sendRevokeAdmin(provider: ContractProvider, via: Sender, value: bigint, queryID: number, adminIndex: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.REVOKE_ADMIN_MASTER_ROOT, 32)
                .storeUint(queryID, 64)
                .storeUint(adminIndex, 64)
                .endCell(),
        });
    }

    async sendChangeFees(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        orderFeeNumerator: number,
        orderFeeDenominator: number,
        userCreationFee: bigint,
        orderCreationFee: bigint,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CHANGE_FEES, 32)
                .storeUint(queryID, 64)
                .storeUint(orderFeeNumerator, 8)
                .storeUint(orderFeeDenominator, 8)
                .storeCoins(userCreationFee)
                .storeCoins(orderCreationFee)
                .endCell(),
        });
    }
    async sendChangeCategoryPercent(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        category: string,
        agreementPercentage: number,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CHANGE_CATEGORY_PERCENT, 32)
                .storeUint(queryID, 64)
                .storeUint(sha256Hash(category), 256)
                .storeUint(agreementPercentage, 64)
                .endCell(),
        });
    }

    async sendDeactivateCategory(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        category: string,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.DEACTIVATE_CATEGORY, 32)
                .storeUint(queryID, 64)
                .storeUint(sha256Hash(category), 256)
                .endCell(),
        });
    }

    async sendActivateCategory(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        category: string,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.ACTIVATE_CATEGORY, 32)
                .storeUint(queryID, 64)
                .storeUint(sha256Hash(category), 256)
                .endCell(),
        });
    }

    async sendDeleteCategory(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        category: string,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.DELETE_CATEGORY, 32)
                .storeUint(queryID, 64)
                .storeUint(sha256Hash(category), 256)
                .endCell(),
        });
    }

    async sendWithdrawFunds(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.WITHDRAW_FUNDS, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async send81(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(81, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async getIndexes(provider: ContractProvider): Promise<Indexes> {
        const result = await provider.get('get_indexes', []);

        return {
            orderNextIndex: result.stack.readNumber(),
            userNextIndex: result.stack.readNumber(),
            adminNextIndex: result.stack.readNumber(),
        };
    }

    async getCodes(provider: ContractProvider): Promise<Codes> {
        const result = await provider.get('get_codes', []);

        return {
            orderCode: result.stack.readCell(),
            userCode: result.stack.readCell(),
            adminCode: result.stack.readCell(),
        };
    }

    async getCategoryData(provider: ContractProvider, category: string): Promise<CategoryValue> {
        const result = await provider.get('get_category_data', [{ type: 'int', value: sha256Hash(category) }]);

        return {
            active: result.stack.readBoolean(),
            adminCount: result.stack.readNumber(),
            activeOrderCount: result.stack.readNumber(),
            agreementPercentage: result.stack.readNumber(),
            adminCountForActive: result.stack.readNumber(),
        };
    }

    async getMasterData(provider: ContractProvider): Promise<MasterData> {
        const result = await provider.get('get_master_data', []);

        const rootAddress = result.stack.readAddress();
        const categoriesDict = result.stack.readCellOpt();
        const orderFeeNumerator = result.stack.readNumber();
        const orderFeeDenominator = result.stack.readNumber();
        const userCreationFee = result.stack.readBigNumber();
        const orderCreationFee = result.stack.readBigNumber();

        if (categoriesDict) {
            const categories = categoriesDict
                .beginParse()
                .loadDictDirect(Dictionary.Keys.BigUint(256), createCategoryValue());
            return {
                rootAddress,
                categories,
                orderFeeNumerator,
                orderFeeDenominator,
                userCreationFee,
                orderCreationFee,
            };
        }

        return {
            rootAddress,
            categories: undefined,
            orderFeeNumerator,
            orderFeeDenominator,
            userCreationFee,
            orderCreationFee,
        };
    }
}
