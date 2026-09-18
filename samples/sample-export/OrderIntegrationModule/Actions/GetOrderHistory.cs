using System.Collections.Generic;

namespace OrderIntegrationModule.Actions
{
    public class GetOrderHistory
    {
        public List<Order> Execute(string accountId)
        {
            var orders = OrderDataProvider.GetList();
            return orders;
        }
    }
}
