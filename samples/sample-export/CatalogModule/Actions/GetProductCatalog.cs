using System.Collections.Generic;

namespace CatalogModule.Actions
{
    public class GetProductCatalog
    {
        public List<Product> Execute()
        {
            var products = ProductDataProvider.GetAll();
            return products;
        }
    }
}
