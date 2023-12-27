import { Blockchain, internal, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, Dictionary, toNano } from '@ton/core';
import { Master } from '../wrappers/Master';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { printTransactionFees } from './utils/printTransactionFees';
import { buildAdminContent, buildOrderContent, buildResponseContent, buildUserContent } from './utils/buildContent';
import { getAddressBigInt, sha256Hash } from './utils/helpers';
import { Admin } from '../wrappers/Admin';
import { User } from '../wrappers/User';
import { Order, Status } from '../wrappers/Order';
import { ERRORS, OPCODES } from '../wrappers/Config';

describe('AlfaMaterCore', () => {
    let blockchain: Blockchain;

    let masterCode: Cell;
    let adminCode: Cell;
    let userCode: Cell;
    let orderCode: Cell;

    let master: SandboxContract<Master>;
    let adminContracts: SandboxContract<Admin>[] = [];
    let userContracts: SandboxContract<User>[] = [];
    let orderContracts: SandboxContract<Order>[] = [];

    let deployer: SandboxContract<TreasuryContract>;
    let root: SandboxContract<TreasuryContract>;
    let admins: SandboxContract<TreasuryContract>[] = [];
    let users: SandboxContract<TreasuryContract>[] = [];
    let orders: SandboxContract<TreasuryContract>[] = [];

    let addresses: { [key: string]: string } = {};
    const protocolFeeNumerator = 2;
    const protocolFeeDenominator = 100;

    beforeAll(async () => {
        masterCode = await compile('Master');
        adminCode = await compile('Admin');
        userCode = await compile('User');
        orderCode = await compile('Order');

        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        root = await blockchain.treasury('root');
        for (let i = 0; i < 3; i++) {
            admins.push(await blockchain.treasury('admin ' + i));
            users.push(await blockchain.treasury('user ' + i));
            orders.push(await blockchain.treasury('order ' + i));
        }

        master = blockchain.openContract(
            Master.createFromConfig(
                {
                    rootAddress: root.address,
                    adminCode: adminCode,
                    userCode: userCode,
                    orderCode: orderCode,
                    feeNumerator: protocolFeeNumerator,
                    feeDenominator: protocolFeeDenominator,
                },
                masterCode,
            ),
        );

        const deployResult = await master.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: master.address,
            deploy: true,
            success: true,
        });

        addresses[master.address.toString()] = 'master';
        addresses[deployer.address.toString()] = 'deployer';
        addresses[root.address.toString()] = 'root';
        for (let i = 0; i < 3; i++) {
            addresses[admins[i].address.toString()] = 'admin ' + i;
            addresses[users[i].address.toString()] = 'user ' + i;
            addresses[orders[i].address.toString()] = 'order ' + i;
        }
    });

    it('master should deploy correctly', async () => {
        const indexes = await master.getIndexes();
        expect(indexes.orderNextIndex).toStrictEqual(0);
        expect(indexes.userNextIndex).toStrictEqual(0);
        expect(indexes.adminNextIndex).toStrictEqual(0);

        const codes = await master.getCodes();
        expect(codes.orderCode.hash().toString('hex')).toStrictEqual(orderCode.hash().toString('hex'));
        expect(codes.userCode.hash().toString('hex')).toStrictEqual(userCode.hash().toString('hex'));
        expect(codes.adminCode.hash().toString('hex')).toStrictEqual(adminCode.hash().toString('hex'));

        const masterData = await master.getMasterData();
        expect(masterData.rootAddress.toString()).toStrictEqual(root.address.toString());
        expect(masterData.categories).toBeUndefined();
        expect(masterData.feeNumerator).toStrictEqual(protocolFeeNumerator);
        expect(masterData.feeDenominator).toStrictEqual(protocolFeeDenominator);
    });

    it('should create category all', async () => {
        const result = await master.sendCreateCategory(root.getSender(), toNano('0.05'), 3, 'all', 666666667);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getCategoryData('all');
        expect(categoryData.active).toStrictEqual(true);
        expect(categoryData.adminCount).toStrictEqual(0);
        expect(categoryData.activeOrderCount).toStrictEqual(0);
        expect(categoryData.agreementPercentage).toStrictEqual(666666667);
    });

    it('should create admin with root', async () => {
        const content = buildAdminContent({
            category: 'all',
            canApproveUser: true,
            canRevokeUser: true,
        });
        const result = await master.sendCreateAdmin(root.getSender(), toNano('0.05'), 3, content, admins[0].address);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });
        const adminContractAddress = getAddressBigInt(result.transactions[2].address);
        const adminContract = blockchain.openContract(Admin.createFromAddress(adminContractAddress));
        adminContracts.push(adminContract);
        addresses[adminContract.address.toString()] = 'admin contract ' + (adminContracts.length - 1);

        const adminData = await adminContract.getAdminData();
        expect(adminData.init).toBeTruthy();
        expect(adminData.index).toStrictEqual(0);
        expect(adminData.masterAddress.toString()).toStrictEqual(master.address.toString());
        expect(adminData.adminAddress.toString()).toStrictEqual(admins[0].address.toString());
        expect(adminData.content.get(sha256Hash('category'))!.beginParse().loadUintBig(256)).toStrictEqual(
            sha256Hash('all'),
        );

        const categoryData = await master.getCategoryData('all');
        expect(categoryData.adminCount).toStrictEqual(1);

        const masterData = await master.getIndexes();
        expect(masterData.adminNextIndex).toStrictEqual(1);
    });

    it('all admin can not create another all admin', async () => {
        const content = buildAdminContent({
            category: 'all',
            canApproveUser: true,
            canRevokeUser: true,
        });
        const result = await adminContracts[0].sendCreateAdmin(
            admins[0].getSender(),
            toNano('0.05'),
            4,
            content,
            admins[1].address,
        );
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[0].address,
            to: master.address,
            success: false,
            exitCode: ERRORS.UNAUTHORIZED,
        });
    });

    it('should create category test', async () => {
        const result = await master.sendCreateCategory(root.getSender(), toNano('0.05'), 3, 'test', 333333333);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.active).toStrictEqual(true);
        expect(categoryData.adminCount).toStrictEqual(0);
        expect(categoryData.activeOrderCount).toStrictEqual(0);
        expect(categoryData.agreementPercentage).toStrictEqual(333333333);
    });

    it('should create admin with admin', async () => {
        const content = buildAdminContent({
            category: 'test',
            canApproveUser: true,
            canRevokeUser: true,
        });
        const result = await adminContracts[0].sendCreateAdmin(
            admins[0].getSender(),
            toNano('0.05'),
            3,
            content,
            admins[1].address,
        );
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[0].address,
            to: master.address,
            success: true,
        });
        const adminContractAddress = getAddressBigInt(result.transactions[3].address);
        const adminContract = blockchain.openContract(Admin.createFromAddress(adminContractAddress));
        adminContracts.push(adminContract);
        addresses[adminContract.address.toString()] = 'admin contract ' + (adminContracts.length - 1);

        const adminData = await adminContract.getAdminData();
        expect(adminData.init).toBeTruthy();
        expect(adminData.index).toStrictEqual(1);
        expect(adminData.masterAddress.toString()).toStrictEqual(master.address.toString());
        expect(adminData.adminAddress.toString()).toStrictEqual(admins[1].address.toString());
        expect(adminData.revokedAt).toStrictEqual(0);
        expect(adminData.content.get(sha256Hash('category'))!.beginParse().loadUintBig(256)).toStrictEqual(
            sha256Hash('test'),
        );

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.adminCount).toStrictEqual(1);

        const masterData = await master.getIndexes();
        expect(masterData.adminNextIndex).toStrictEqual(2);

        printTransactionFees(result.transactions, 'creating admin by another admin', addresses);
    });

    it('should create 2 users', async () => {
        const content = buildUserContent(true, true);
        const result = await master.sendCreateUser(users[0].getSender(), toNano('0.05'), 3, content);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: master.address,
            success: true,
        });
        const userContractAddress = getAddressBigInt(result.transactions[2].address);
        const userContract = blockchain.openContract(User.createFromAddress(userContractAddress));
        userContracts.push(userContract);
        addresses[userContract.address.toString()] = 'user contract ' + (userContracts.length - 1);

        const userData = await userContract.getUserData();
        expect(userData.init).toBeTruthy();
        expect(userData.index).toStrictEqual(0);
        expect(userData.masterAddress.toString()).toStrictEqual(master.address.toString());
        expect(userData.userAddress.toString()).toStrictEqual(users[0].address.toString());
        expect(userData.revokedAt).toStrictEqual(1);

        const masterData = await master.getIndexes();
        expect(masterData.userNextIndex).toStrictEqual(1);

        printTransactionFees(result.transactions, 'creating user', addresses);
    });

    it('should activate user', async () => {
        const result = await adminContracts[1].sendActivateUser(admins[1].getSender(), toNano('0.05'), 3, 0);
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[1].address,
            to: master.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: userContracts[0].address,
            success: true,
        });

        const userData = await userContracts[0].getUserData();
        expect(userData.revokedAt).toStrictEqual(0);
    });

    /*
        user 0 - customer
        user 1 - freelancer
     */

    it('should create order', async () => {
        const content = buildOrderContent('test');
        const deadline = Math.floor(Date.now() / 1000) + 100;
        const result = await userContracts[0].sendCreateOrder(
            users[0].getSender(),
            toNano('10'),
            3,
            content,
            toNano('0.05'),
            deadline,
        );
        expect(result.transactions).toHaveTransaction({
            from: userContracts[0].address,
            to: master.address,
            success: true,
        });

        const orderContractAddress = getAddressBigInt(result.transactions[3].address);
        const orderContract = blockchain.openContract(Order.createFromAddress(orderContractAddress));
        orderContracts.push(orderContract);
        addresses[orderContract.address.toString()] = 'order contract ' + (orderContracts.length - 1);

        const orderData = await orderContract.getOrderData();
        expect(orderData.init).toBeTruthy();
        expect(orderData.index).toStrictEqual(0);
        expect(orderData.masterAddress.toString()).toStrictEqual(master.address.toString());
        expect(orderData.status).toStrictEqual(Status.moderation);
        expect(orderData.price).toStrictEqual(toNano('0.05'));
        expect(orderData.deadline).toStrictEqual(deadline);
        expect(orderData.customerAddress.toString()).toStrictEqual(users[0].address.toString());
        expect(orderData.freelancerAddress).toBeNull();
        expect(orderData.content.get(sha256Hash('category'))!.beginParse().loadUintBig(256)).toStrictEqual(
            sha256Hash('test'),
        );

        const arbitrationData = await orderContract.getArbitrationData();
        expect(arbitrationData.adminVotedCount).toStrictEqual(0);
        expect(arbitrationData.freelancerPart).toStrictEqual(0);
        expect(arbitrationData.customerPart).toStrictEqual(0);
        expect(arbitrationData.adminCount).toStrictEqual(0);
        expect(arbitrationData.agreementPercent).toStrictEqual(0);

        const responsesData = await orderContract.getResponses();
        expect(responsesData.responses).toBeNull();
        expect(responsesData.responsesCount).toStrictEqual(0);

        const masterData = await master.getIndexes();
        expect(masterData.orderNextIndex).toStrictEqual(1);
    });

    it('should activate order', async () => {
        const result = await adminContracts[1].sendActivateOrder(admins[1].getSender(), toNano('0.05'), 3, 0);
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[1].address,
            to: master.address,
            success: true,
            op: OPCODES.ACTIVATE_ORDER_MASTER,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: orderContracts[0].address,
            success: true,
            op: OPCODES.ACTIVATE_ORDER,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.ORDER_ACTIVATE_NOTIFICATION,
        });

        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.active);

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.activeOrderCount).toStrictEqual(1);

        printTransactionFees(result.transactions, 'activating order', addresses);
    });

    it('should create 2 user and activate', async () => {
        const content = buildUserContent(true, true);
        const result = await master.sendCreateUser(users[1].getSender(), toNano('0.05'), 3, content);
        expect(result.transactions).toHaveTransaction({
            from: users[1].address,
            to: master.address,
            success: true,
        });
        const userContractAddress = getAddressBigInt(result.transactions[2].address);
        const userContract = blockchain.openContract(User.createFromAddress(userContractAddress));
        userContracts.push(userContract);
        addresses[userContract.address.toString()] = 'user contract ' + (userContracts.length - 1);

        const result2 = await adminContracts[1].sendActivateUser(admins[1].getSender(), toNano('0.05'), 3, 1);
        expect(result2.transactions).toHaveTransaction({
            from: adminContracts[1].address,
            to: master.address,
            success: true,
        });
        expect(result2.transactions).toHaveTransaction({
            from: master.address,
            to: userContracts[1].address,
            success: true,
        });

        const userData2 = await userContracts[1].getUserData();
        expect(userData2.revokedAt).toStrictEqual(0);
    });

    it('should add response', async () => {
        const content = buildResponseContent({
            text: 'test response',
        });
        const result = await userContracts[1].sendAddResponse(users[1].getSender(), toNano('0.05'), 3, 0, content);
        expect(result.transactions).toHaveTransaction({
            from: userContracts[1].address,
            to: master.address,
            success: true,
            op: OPCODES.ADD_RESPONSE_MASTER,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: orderContracts[0].address,
            success: true,
            op: OPCODES.ADD_RESPONSE,
        });

        const responsesData = await orderContracts[0].getResponses();
        expect(responsesData.responsesCount).toStrictEqual(1);
        expect(responsesData.responses!.has(users[1].address)).toBeTruthy();

        const response = responsesData
            .responses!.get(users[1].address)!
            .beginParse()
            .loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        expect(response.get(sha256Hash('text'))!.beginParse().loadStringTail()).toStrictEqual('test response');

        printTransactionFees(result.transactions, 'adding response', addresses);
    });

    it('should not add twice', async () => {
        let result = await userContracts[1].sendAddResponse(users[1].getSender(), toNano('0.05'), 3, 0, Cell.EMPTY);
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: orderContracts[0].address,
            success: false,
            exitCode: ERRORS.ALREADY_RESPONDED,
        });
    });

    it('assign user', async () => {
        const deadline = Math.floor(Date.now() / 1000) + 120;
        let result = await orderContracts[0].sendAssignUser(
            users[0].getSender(),
            toNano('2'),
            3,
            toNano(1),
            deadline,
            users[2].address,
        );
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: false,
            exitCode: ERRORS.FREELANCER_NOT_FOUND,
        });

        result = await orderContracts[0].sendAssignUser(
            users[0].getSender(),
            toNano('2'),
            3,
            toNano(1),
            deadline,
            users[1].address,
        );
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[0].address,
            success: true,
        });

        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.waiting_freelancer);
        expect(orderData.freelancerAddress!.toString()).toStrictEqual(users[1].address.toString());
        expect(orderData.deadline).toStrictEqual(deadline);
        expect(orderData.price).toStrictEqual(toNano(1));
    });

    it('reject order', async () => {
        const result = await orderContracts[0].sendRejectOrder(users[1].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[0].address,
        });
        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.active);
    });

    it('assign user again, cancel and assign', async () => {
        const deadline = Math.floor(Date.now() / 1000) + 120;
        await orderContracts[0].sendAssignUser(
            users[0].getSender(),
            toNano('2'),
            3,
            toNano(1),
            deadline,
            users[1].address,
        );
        let orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.waiting_freelancer);

        const result = await orderContracts[0].sendCancelAssign(users[0].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[0].address,
        });
        orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.active);

        await orderContracts[0].sendAssignUser(
            users[0].getSender(),
            toNano('2'),
            3,
            toNano(1),
            deadline,
            users[1].address,
        );
        orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.waiting_freelancer);
    });

    it('accept order', async () => {
        const result = await orderContracts[0].sendAcceptOrder(users[1].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.ORDER_FEE,
            value: (toNano(1) * BigInt(protocolFeeNumerator)) / BigInt(protocolFeeDenominator),
        });
        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.in_progress);
    });

    it('complete order', async () => {
        let result = await orderContracts[0].sendCompleteOrder(users[0].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: false,
            exitCode: ERRORS.UNAUTHORIZED,
        });

        result = await orderContracts[0].sendCompleteOrder(users[1].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: users[1].address,
            to: orderContracts[0].address,
            success: true,
        });
        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.fulfilled);
    });

    it('customer feedback (success)', async () => {
        const beforeFeedback = blockchain.snapshot();
        const result = await orderContracts[0].sendCustomerFeedback(users[0].getSender(), toNano('0.05'), 3, false);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[1].address,
            success: true,
            op: OPCODES.ORDER_COMPLETED,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.ORDER_COMPLETED_NOTIFICATION,
        });
        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.completed);

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.activeOrderCount).toStrictEqual(0);
        await blockchain.loadFrom(beforeFeedback);
    });

    it('customer feedback (arbitration)', async () => {
        const beforeFeedback = blockchain.snapshot();
        const msgIter = await blockchain.sendMessageIter(
            internal({
                from: users[0].address,
                to: orderContracts[0].address,
                value: toNano('0.05'),
                body: beginCell().storeUint(OPCODES.CUSTOMER_FEEDBACK, 32).storeUint(3, 64).storeBit(true).endCell(),
            }),
        );

        await msgIter.next();
        let orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.pre_arbitration);
        await msgIter.next();
        await msgIter.next();
        orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.on_arbitration);
        await blockchain.loadFrom(beforeFeedback);

        const result = await orderContracts[0].sendCustomerFeedback(users[0].getSender(), toNano('0.05'), 3, true);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.GET_ADMINS,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: orderContracts[0].address,
            success: true,
            op: OPCODES.SET_ADMINS,
        });

        const arbitrationData = await orderContracts[0].getArbitrationData();
        expect(arbitrationData.adminVotedCount).toStrictEqual(0);
        expect(arbitrationData.freelancerPart).toStrictEqual(0);
        expect(arbitrationData.customerPart).toStrictEqual(0);
        expect(arbitrationData.adminCount).toStrictEqual(1);
        expect(arbitrationData.agreementPercent).toStrictEqual(333333333);

        printTransactionFees(result.transactions, 'customer feedback (arbitration)', addresses);
    });

    it('arbitration processing', async () => {
        const result = await adminContracts[1].sendProcessArbitration(
            admins[1].getSender(),
            toNano('0.05'),
            3,
            0,
            70,
            30,
        );
        expect(result.transactions).toHaveTransaction({
            from: admins[1].address,
            to: adminContracts[1].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[1].address,
            to: master.address,
            success: true,
            op: OPCODES.PROCESS_ARBITRATION_MASTER,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: orderContracts[0].address,
            success: true,
            op: OPCODES.PROCESS_ARBITRATION,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[0].address,
            success: true,
            op: OPCODES.ORDER_COMPLETED,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[1].address,
            success: true,
            op: OPCODES.ORDER_COMPLETED,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.ORDER_COMPLETED_NOTIFICATION,
        });

        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.arbitration_solved);

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.activeOrderCount).toStrictEqual(0);

        printTransactionFees(result.transactions, 'arbitration processing', addresses);
    });
});
