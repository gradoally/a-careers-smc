import { toNano } from '@ton/core';
import { Order } from '../wrappers/Order';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromConfig({}, await compile('Order')));

    await order.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(order.address);

    // run methods on `order`
}
