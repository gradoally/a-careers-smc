import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Order } from '../wrappers/Order';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Order', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Order');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let order: SandboxContract<Order>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        order = blockchain.openContract(Order.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await order.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: order.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and order are ready to use
    });
});
