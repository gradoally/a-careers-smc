import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Master } from '../wrappers/Master';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Master', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Master');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let master: SandboxContract<Master>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        master = blockchain.openContract(Master.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await master.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: master.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and master are ready to use
    });
});
