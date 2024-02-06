import {
    Address,
    beginCell,
    Builder,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
    Slice,
} from '@ton/core';
import { OPCODES } from './Config';

export type OrderConfig = {};

export enum Status {
    moderation = 0,
    active = 1,
    waiting_freelancer = 2,
    in_progress = 3,
    fulfilled = 4,
    refunded = 5,
    completed = 6,
    payment_forced = 7,
    pre_arbitration = 8,
    on_arbitration = 9,
    arbitration_solved = 10,
    outdated = 11,
}

export type OrderData = {
    init: boolean;
    index: number;
    masterAddress: Address;
    status: Status;
    price: bigint;
    deadline: number;
    customerAddress: Address;
    freelancerAddress: Address | null;
    content: Dictionary<bigint, Cell>;
};

export type ArbitrationData = {
    adminVotedCount: number;
    freelancerPart: number;
    customerPart: number;
    adminCount: number;
    agreementPercent: number;
};

export type Responses = {
    responses: Dictionary<Address, Cell> | null;
    responsesCount: number;
};

export function orderConfigToCell(config: OrderConfig): Cell {
    return beginCell().endCell();
}

export class Order implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Order(address);
    }

    static createFromConfig(config: OrderConfig, code: Cell, workchain = 0) {
        const data = orderConfigToCell(config);
        const init = { code, data };
        return new Order(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendAssignUser(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        price: bigint,
        deadline: number,
        freelancerAddress: Address,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.ASSIGN_USER, 32)
                .storeUint(queryID, 64)
                .storeCoins(price)
                .storeUint(deadline, 32)
                .storeAddress(freelancerAddress)
                .endCell(),
        });
    }

    async sendRejectOrder(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.REJECT_ORDER, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async sendCancelAssign(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.CANCEL_ASSIGN, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async sendAcceptOrder(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.ACCEPT_ORDER, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async sendCompleteOrder(provider: ContractProvider, via: Sender, value: bigint, queryID: number, result: string) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.COMPLETE_ORDER, 32).storeUint(queryID, 64).storeRef(beginCell().storeStringTail(result).endCell()).endCell(),
        });
    }

    async sendCustomerFeedback(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        arbitration: boolean,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.CUSTOMER_FEEDBACK, 32)
                .storeUint(queryID, 64)
                .storeBit(arbitration)
                .endCell(),
        });
    }

    async sendRefund(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.REFUND, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async sendForcePayment(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OPCODES.FORCE_PAYMENT, 32).storeUint(queryID, 64).endCell(),
        });
    }

    async sendOutdated(provider: ContractProvider, queryID: number) {
        await provider.external(beginCell().storeUint(queryID, 64).endCell());
    }

    async getOrderData(provider: ContractProvider): Promise<OrderData> {
        const result = await provider.get('get_order_data', []);

        return {
            init: result.stack.readBoolean(),
            index: result.stack.readNumber(),
            masterAddress: result.stack.readAddress(),
            status: result.stack.readNumber(),
            price: result.stack.readBigNumber(),
            deadline: result.stack.readNumber(),
            customerAddress: result.stack.readAddress(),
            freelancerAddress: result.stack.readAddressOpt(),
            content: result.stack
                .readCell()
                .beginParse()
                .loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()),
        };
    }

    async getArbitrationData(provider: ContractProvider): Promise<ArbitrationData> {
        const result = await provider.get('get_arbitration_data', []);

        return {
            adminVotedCount: result.stack.readNumber(),
            freelancerPart: result.stack.readNumber(),
            customerPart: result.stack.readNumber(),
            adminCount: result.stack.readNumber(),
            agreementPercent: result.stack.readNumber(),
        };
    }

    async getResponses(provider: ContractProvider): Promise<Responses> {
        const result = await provider.get('get_responses', []);

        const responses = result.stack.readCellOpt();
        const responsesCount = result.stack.readNumber();

        if (responses === null) {
            return {
                responses: null,
                responsesCount,
            };
        }

        return {
            responses: responses.beginParse().loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.Cell()),
            responsesCount,
        };
    }

    async getOrderResult(provider: ContractProvider): Promise<string> {
        const result = await provider.get('get_result', []);
        const orderResultCell = result.stack.readCellOpt();
        if (orderResultCell == null) {
            return "";
        }
        return orderResultCell.beginParse().loadStringTail();
    }
}
