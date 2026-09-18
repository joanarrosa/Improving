using System.Net.Http;

namespace OrderIntegrationModule.Integrations
{
    // Generated-style wrapper around the external Order API integration.
    public class OrderApiIntegrationActions
    {
        public string GetOrderStatus(string orderId)
        {
            var orderApiHttpClient = new HttpClient();
            var response = orderApiHttpClient.GetAsync("https://api.orders.example.com/status/" + orderId).Result;
            return response.Content.ReadAsStringAsync().Result;
        }
    }
}
