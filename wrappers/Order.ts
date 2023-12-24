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

export type OrderConfig = {};

/*
const int status::moderation = 0;
const int status::active = 1;
const int status::waiting_freelancer = 2;
const int status::in_progress = 3;
const int status::fulfilled = 4;
const int status::completed = 5;
const int status::pre_arbitration = 6;
const int status::on_arbitration = 7;
const int status::arbitration_solved = 8;
 */

export enum Status {
    moderation = 0,
    active,
    waiting_freelancer,
    in_progress,
    fulfilled,
    completed,
    pre_arbitration,
    on_arbitration,
    arbitration_solved,
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
    responses: Dictionary<Address, Slice> | null;
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
            responses: responses.beginParse().loadDictDirect(Dictionary.Keys.Address(), {
                parse: (slice: Slice) => slice,
                serialize: (src: Slice, builder: Builder) => {
                    return builder;
                },
            }),
            responsesCount,
        };
    }
}
