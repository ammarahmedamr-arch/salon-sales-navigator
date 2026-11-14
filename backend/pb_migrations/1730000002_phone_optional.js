/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);

  // Make 'phone' optional so Excel rows without a valid mobile still import.
  const clients = dao.findCollectionByNameOrId("clients");
  const phoneField = clients.schema.getFieldByName("phone");
  if (phoneField) {
    phoneField.required = false;
    dao.saveCollection(clients);
  }
});
