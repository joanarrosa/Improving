using System.Collections.Generic;

namespace CatalogModule.Actions
{
    public class RefreshProductPrices
    {
        public void Execute(List<string> productIds)
        {
            foreach (var productId in productIds)
            {
                var product = ProductDataProvider.GetById(productId);
                var taxRate = GetProductTaxRate(productId);
                var basePrice = product.Price;
                var finalPrice = basePrice + (basePrice * GetProductTaxRate(productId));
                product.Price = finalPrice;
            }
        }

        private decimal GetProductTaxRate(string productId)
        {
            return TaxDataProvider.GetById(productId).Rate;
        }
    }
}
