// Employee data access is always through the authenticated location handlers, never direct table access.
export const serverOwnedEntities = ['DeliveryScan','DeliveryDraft','InventoryRun','DeliveryLine','ArticleProposal','PriceChangeRequest','InventoryOutletBinding','CatalogImportBatch','BookingProbeStock'];
export const adminManagedEntities = ['Article','Category','Delivery','GlobalItem','Inventory','InventorySession','Outlet','OutletItem','OutletStock','OutletTransfer','PriceHistory','StockMovement','Supplier','SupplierItem','Unit','Waste'];
