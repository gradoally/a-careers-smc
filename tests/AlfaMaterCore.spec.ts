import { Blockchain, BlockchainSnapshot, internal, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, Dictionary, toNano, TransactionDescriptionGeneric } from '@ton/core';
import { Master } from '../wrappers/Master';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { printTransactionFees } from './utils/printTransactionFees';
import { buildAdminContent, buildOrderContent, buildResponseContent, buildUserContent } from './utils/buildContent';
import { getAddressBigInt, sha256Hash } from '../wrappers/Helpers';
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
    let user81: SandboxContract<TreasuryContract>;
    let admins: SandboxContract<TreasuryContract>[] = [];
    let users: SandboxContract<TreasuryContract>[] = [];
    let orders: SandboxContract<TreasuryContract>[] = [];

    let addresses: { [key: string]: string } = {};
    const orderFeeNumerator = 2;
    const orderFeeDenominator = 100;
    const userCreationFee = toNano('2');
    const orderCreationFee = toNano('1');
    const orderPrice: bigint = toNano(1);
    let beforeOrderComplete: BlockchainSnapshot;
    let beforeOrderStart: BlockchainSnapshot;

    beforeAll(async () => {
        masterCode = await compile('Master');
        adminCode = await compile('Admin');
        userCode = await compile('User');
        orderCode = await compile('Order');
        console.log('Admin code (hex):' + adminCode.toBoc().toString('hex'));
        console.log('User code (hex):' + userCode.toBoc().toString('hex'));
        console.log('Order code (hex):' + orderCode.toBoc().toString('hex'));

        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        root = await blockchain.treasury('root');
        user81 = await blockchain.treasury('user81');
        for (let i = 0; i < 3; i++) {
            admins.push(await blockchain.treasury('admin ' + i));
            users.push(await blockchain.treasury('user ' + i));
            orders.push(await blockchain.treasury('order ' + i));
        }

        master = blockchain.openContract(
            Master.createFromConfig(
                {
                    rootAddress: root.address,
                    address81: user81.address,
                    adminCode: adminCode,
                    userCode: userCode,
                    orderCode: orderCode,
                    orderFeeNumerator: orderFeeNumerator,
                    orderFeeDenominator: orderFeeDenominator,
                    userCreationFee: userCreationFee,
                    orderCreationFee: orderCreationFee,
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
        expect(masterData.orderFeeNumerator).toStrictEqual(orderFeeNumerator);
        expect(masterData.orderFeeDenominator).toStrictEqual(orderFeeDenominator);
        expect(masterData.userCreationFee).toStrictEqual(userCreationFee);
        expect(masterData.orderCreationFee).toStrictEqual(orderCreationFee);
    });

    it('should create category all', async () => {
        const result = await master.sendCreateCategory(root.getSender(), toNano('0.05'), 3, 'all', 666666667, 1);
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
        expect(categoryData.adminCountForActive).toStrictEqual(1);
    });

    it('should create admin with root', async () => {
        const content = buildAdminContent({
            category: 'all',
            canApproveUser: true,
            canRevokeUser: true,
            nickname: 'test',
            about: 'test',
            website: 'test',
            portfolio: 'test',
            resume: 'test',
            specialization: 'test',
        });
        const result = await master.sendCreateAdmin(root.getSender(), toNano('1'), 3, content, admins[0].address);
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

        printTransactionFees(result.transactions, 'creating admin by root', addresses);
    });

    it('all admin can not create another all admin', async () => {
        const content = buildAdminContent({
            category: 'all',
            canApproveUser: true,
            canRevokeUser: true,
            nickname: 'test',
            about: 'test',
            website: 'test',
            portfolio: 'test',
            resume: 'test',
            specialization: 'test',
        });
        const result = await adminContracts[0].sendCreateAdmin(
            admins[0].getSender(),
            toNano('1'),
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
        const categoryName = 'test'; //.repeat(100);
        const result = await master.sendCreateCategory(root.getSender(), toNano('0.05'), 3, categoryName, 333333333, 1);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getCategoryData(categoryName);
        expect(categoryData.name).toStrictEqual(categoryName);
        expect(categoryData.active).toStrictEqual(true);
        expect(categoryData.adminCount).toStrictEqual(0);
        expect(categoryData.activeOrderCount).toStrictEqual(0);
        expect(categoryData.agreementPercentage).toStrictEqual(333333333);
    });

    it('should create language test', async () => {
        const langName = 'en'; //.repeat(100);
        const result = await master.sendCreateLang(root.getSender(), toNano('0.05'), 3, langName);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getLanguageData(langName);
        expect(categoryData.name).toStrictEqual(langName);
    });

    it('should create admin with admin', async () => {
        const content = buildAdminContent({
            category: 'test',
            canApproveUser: true,
            canRevokeUser: true,
            nickname: 'test',
            about: 'test',
            website: 'test',
            portfolio: 'test',
            resume: 'test',
            specialization: 'test',
        });
        const result = await adminContracts[0].sendCreateAdmin(
            admins[0].getSender(),
            toNano('1'),
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

    it('should create user', async () => {
        const content = buildUserContent({
            isUser: true,
            isFreelancer: true,
            nickname: 'test',
            telegram: 'test',
            about: 'test',
            website: 'test',
            portfolio: 'test',
            resume: 'test',
            specialization: 'test',
            language: 'en',
        });
        const masterBalanceBefore = (await blockchain.getContract(master.address)).balance;
        const result = await master.sendCreateUser(users[0].getSender(), toNano('4'), 3, content);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: master.address,
            success: true,
        });

        const txDescription = result.transactions[1].description as TransactionDescriptionGeneric;
        expect((await blockchain.getContract(master.address)).balance).toStrictEqual(
            masterBalanceBefore + userCreationFee - txDescription.storagePhase!.storageFeesCollected,
        );
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

        printTransactionFees(result.transactions, 'activating user', addresses);
    });

    /*
        user 0 - customer
        user 1 - freelancer
     */

    it('should create order', async () => {
        const content = buildOrderContent({
            category: 'test',
            name: 'test',
            description: 'test',
            technicalTask: 'test',
            language: 'en',
        });
        const deadline = Math.floor(Date.now() / 1000) + 100;
        const timeForCheck = 100;
        const result = await userContracts[0].sendCreateOrder(
            users[0].getSender(),
            toNano('10'),
            3,
            content,
            orderPrice,
            deadline,
            timeForCheck,
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
        expect(orderData.price).toStrictEqual(orderPrice);
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

        printTransactionFees(result.transactions, 'creating order', addresses);
    });

    it('should activate order', async () => {
        const result = await adminContracts[1].sendActivateOrder(admins[1].getSender(), toNano('0.1'), 3, 0);
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
        beforeOrderStart = blockchain.snapshot();

        printTransactionFees(result.transactions, 'activating order', addresses);
    });

    it('should create 2 user and activate', async () => {
        const content = buildUserContent({
            isUser: true,
            isFreelancer: true,
            nickname: 'test',
            telegram: 'test',
            about: 'test',
            website: 'test',
            portfolio: 'test',
            resume: 'test',
            specialization: 'test',
            language: 'en',
        });
        const masterBalanceBefore = (await blockchain.getContract(master.address)).balance;
        const result = await master.sendCreateUser(users[1].getSender(), toNano('5'), 3, content);
        expect(result.transactions).toHaveTransaction({
            from: users[1].address,
            to: master.address,
            success: true,
        });
        const txDescription = result.transactions[1].description as TransactionDescriptionGeneric;
        expect((await blockchain.getContract(master.address)).balance).toStrictEqual(
            masterBalanceBefore + userCreationFee - txDescription.storagePhase!.storageFeesCollected,
        );
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
            price: toNano(2),
            deadline: Math.floor(Date.now() / 1000) + 120,
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
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: false,
            op: OPCODES.MASTER_LOG,
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
            orderPrice,
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
            orderPrice,
            deadline,
            users[1].address,
        );
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: false,
            op: OPCODES.MASTER_LOG,
        });
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
        expect(orderData.price).toStrictEqual(orderPrice);

        printTransactionFees(result.transactions, 'assign user', addresses);
    });

    it('reject order', async () => {
        const result = await orderContracts[0].sendRejectOrder(users[1].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: false,
            op: OPCODES.MASTER_LOG,
        });
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
            orderPrice,
            deadline,
            users[1].address,
        );
        let orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.waiting_freelancer);

        const result = await orderContracts[0].sendCancelAssign(users[0].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: false,
            op: OPCODES.MASTER_LOG,
        });
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
            orderPrice,
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
            value: (orderPrice * BigInt(orderFeeNumerator)) / BigInt(orderFeeDenominator),
        });
        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.in_progress);
    });

    it('complete order', async () => {
        beforeOrderComplete = blockchain.snapshot();

        const resultMessage: string = "Done :)";

        let result = await orderContracts[0].sendCompleteOrder(users[0].getSender(), toNano('0.05'), 3, resultMessage);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: false,
            exitCode: ERRORS.UNAUTHORIZED,
        });

        result = await orderContracts[0].sendCompleteOrder(users[1].getSender(), toNano('0.05'), 3, resultMessage);
        expect(result.transactions).toHaveTransaction({
            from: users[1].address,
            to: orderContracts[0].address,
            success: true,
        });
        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.fulfilled);

        const orderResult = await orderContracts[0].getOrderResult();
        expect(orderResult).toStrictEqual(resultMessage);
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
            value: orderPrice - (orderPrice * BigInt(orderFeeNumerator)) / BigInt(orderFeeDenominator),
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
        const result = await adminContracts[1].sendProcessArbitration(admins[1].getSender(), toNano('1'), 3, 0, 30, 70);
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
        const payment = orderPrice - (orderPrice * BigInt(orderFeeNumerator)) / BigInt(orderFeeDenominator);
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[0].address,
            success: true,
            op: OPCODES.ORDER_COMPLETED,
            value: (payment * BigInt(30)) / BigInt(100),
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[1].address,
            success: true,
            op: OPCODES.ORDER_COMPLETED,
            value: (payment * BigInt(70)) / BigInt(100),
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
        await blockchain.loadFrom(beforeOrderComplete);

        printTransactionFees(result.transactions, 'arbitration processing', addresses);
    });

    it('refund before deadline', async () => {
        blockchain.now = Math.floor(Date.now() / 1000) + 50;
        const result = await orderContracts[0].sendRefund(users[0].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: false,
        });
    });

    it('refund after deadline', async () => {
        blockchain.now = Math.floor(Date.now() / 1000) + 1000;
        const result = await orderContracts[0].sendRefund(users[0].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: orderContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: users[0].address,
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
        expect(orderData.status).toStrictEqual(Status.refunded);
        await blockchain.loadFrom(beforeOrderComplete);
    });

    it('force payment after check time', async () => {
        await orderContracts[0].sendCompleteOrder(users[1].getSender(), toNano('0.05'), 3, "qwerty");
        blockchain.now = Math.floor(Date.now() / 1000) + 1000;
        const result = await orderContracts[0].sendForcePayment(users[1].getSender(), toNano('0.05'), 3);
        expect(result.transactions).toHaveTransaction({
            from: users[1].address,
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
        expect(orderData.status).toStrictEqual(Status.payment_forced);
    });

    it('outdated order after deadline', async () => {
        await blockchain.loadFrom(beforeOrderStart);
        const result = await orderContracts[0].sendOutdated(2);
        expect(result.transactions).toHaveTransaction({
            to: orderContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: orderContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.ORDER_COMPLETED_NOTIFICATION,
        });

        const orderData = await orderContracts[0].getOrderData();
        expect(orderData.status).toStrictEqual(Status.outdated);
        await blockchain.loadFrom(beforeOrderComplete);
    });

    it('revoke user by test admin', async () => {
        const result = await adminContracts[1].sendRevokeUser(admins[1].getSender(), toNano('0.05'), 3, 0);
        expect(result.transactions).toHaveTransaction({
            from: admins[1].address,
            to: adminContracts[1].address,
            success: true,
        });
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

        let userData = await userContracts[0].getUserData();
        expect(userData.revokedAt).toStrictEqual(result.transactions[3].now);
    });

    it('revoke test admin by all admin', async () => {
        const result = await adminContracts[0].sendRevokeAdmin(admins[0].getSender(), toNano('0.05'), 3, 1);
        expect(result.transactions).toHaveTransaction({
            from: admins[0].address,
            to: adminContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[0].address,
            to: master.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: adminContracts[1].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[1].address,
            to: master.address,
            success: true,
            op: OPCODES.ADMIN_REVOKED_NOTIFICATION,
        });

        let adminData = await adminContracts[1].getAdminData();
        expect(adminData.revokedAt).toStrictEqual(result.transactions[3].now);

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.adminCount).toStrictEqual(0);
    });

    it('revoke all admin by root', async () => {
        const result = await master.sendRevokeAdmin(root.getSender(), toNano('0.05'), 3, 0);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: adminContracts[0].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: adminContracts[0].address,
            to: master.address,
            success: true,
            op: OPCODES.ADMIN_REVOKED_NOTIFICATION,
        });

        let adminData = await adminContracts[0].getAdminData();
        expect(adminData.revokedAt).toStrictEqual(result.transactions[2].now);
    });

    it('moderation after user changes content', async () => {
        const newContent = buildUserContent({
            isUser: true,
            isFreelancer: false,
            nickname: 'test',
            telegram: 'test',
            about: 'test',
            website: 'test',
            portfolio: 'test',
            resume: 'test',
            specialization: 'test',
            language: 'en',
        });
        const result = await userContracts[1].sendChangeContent(users[1].getSender(), toNano('0.05'), 3, newContent);
        expect(result.transactions).toHaveTransaction({
            from: users[1].address,
            to: userContracts[1].address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: userContracts[1].address,
            to: master.address,
            success: false,
            op: OPCODES.MASTER_LOG,
        });

        const userData = await userContracts[1].getUserData();
        expect(userData.content.get(sha256Hash('is_user'))!.beginParse().loadBit()).toStrictEqual(true);
        expect(userData.content.get(sha256Hash('is_freelancer'))!.beginParse().loadBit()).toStrictEqual(false);
    });
    it('change fees', async () => {
        const result = await master.sendChangeFees(
            root.getSender(),
            toNano('0.05'),
            3,
            6,
            50,
            toNano('0.1'),
            toNano('0.2'),
        );
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const masterData = await master.getMasterData();
        expect(masterData.orderFeeNumerator).toStrictEqual(6);
        expect(masterData.orderFeeDenominator).toStrictEqual(50);
        expect(masterData.userCreationFee).toStrictEqual(toNano('0.1'));
        expect(masterData.orderCreationFee).toStrictEqual(toNano('0.2'));
    });

    it('change category percent', async () => {
        const result = await master.sendChangeCategoryPercent(root.getSender(), toNano('0.05'), 1, 'test', 433333333);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.agreementPercentage).toStrictEqual(433333333);
    });

    it('disable category', async () => {
        const result = await master.sendDeactivateCategory(root.getSender(), toNano('0.05'), 1, 'test');
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.active).toStrictEqual(false);
    });

    it('enable category', async () => {
        const result = await master.sendActivateCategory(root.getSender(), toNano('0.05'), 1, 'test');
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const categoryData = await master.getCategoryData('test');
        expect(categoryData.active).toStrictEqual(true);
    });

    it('delete category', async () => {
        let result = await master.sendDeleteCategory(root.getSender(), toNano('0.05'), 1, 'test');
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: false,
            exitCode: ERRORS.DELETION_NOT_ALLOWED,
        });

        await blockchain.loadFrom(beforeOrderStart);
        blockchain.now = Math.floor(Date.now() / 1000) + 1000;
        await orderContracts[0].sendOutdated(2);
        await master.sendRevokeAdmin(root.getSender(), toNano('0.05'), 3, 1);

        result = await master.sendDeleteCategory(root.getSender(), toNano('0.05'), 1, 'test');
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });

        const masterData = await master.getMasterData();
        console.log(masterData.categories);
        expect(masterData.categories!.size).toStrictEqual(1);
    });

    it('withdraw funds from protocol', async () => {
        const result = await master.sendWithdrawFunds(root.getSender(), toNano('0.05'), 2);
        expect(result.transactions).toHaveTransaction({
            from: root.address,
            to: master.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: root.address,
            success: true,
        });

        expect((await blockchain.getContract(master.address)).balance).toStrictEqual(toNano(0.1));
    });

    it('81', async () => {
        const masterBalanceBefore = (await blockchain.getContract(master.address)).balance;
        const result = await master.send81(user81.getSender(), toNano(81.1), 81);
        expect(result.transactions).toHaveTransaction({
            from: user81.address,
            to: master.address,
            success: true,
            exitCode: 81,
        });
        expect(result.transactions).toHaveTransaction({
            from: master.address,
            to: user81.address,
            success: true,
        });

        const txDescription = result.transactions[1].description as TransactionDescriptionGeneric;
        expect((await blockchain.getContract(master.address)).balance).toStrictEqual(
            masterBalanceBefore + toNano(81) - txDescription.storagePhase!.storageFeesCollected,
        );
        printTransactionFees(result.transactions, '81', addresses);
    });
});
