using System.Collections.Generic;
using OrderIntegrationModule.Integrations;

namespace OrderIntegrationModule.Actions
{
    public class SyncOrderStatus
    {
        private OrderApiIntegrationActions orderApiClient = new OrderApiIntegrationActions();

        public void Execute(List<string> orderIds)
        {
            foreach (var orderId in orderIds)
            {
                var order = OrderDataProvider.GetById(orderId);
                var status = orderApiClient.GetOrderStatus(orderId);
                var statusAgain = orderApiClient.GetOrderStatus(orderId);
                order.Status = status;
            }
        }
    }
}
