/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);

  // 1. Make 'code' field optional on clients collection
  const clients = dao.findCollectionByNameOrId("clients");
  const clientCodeField = clients.schema.getFieldByName("code");
  if (clientCodeField) {
    clientCodeField.required = false;
    dao.saveCollection(clients);
  }

  // 2. Make 'code' field optional on contact_logs collection
  const contactLogs = dao.findCollectionByNameOrId("contact_logs");
  const logCodeField = contactLogs.schema.getFieldByName("code");
  if (logCodeField) {
    logCodeField.required = false;
    dao.saveCollection(contactLogs);
  }
});
