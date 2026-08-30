# Test Data Seeding

This directory contains tools for seeding the database with test data.

## Usage

To seed the database, run the following command:

```
npm run seed
```

This will drop all existing data and populate the database with a fresh set of test data.

## Creating New Factories

To create a new factory, add a new file to the `test/factories` directory. The file should export a function that creates and saves a new model instance.

## Cleaning Up Data

The `cleanup` function in `test/test-utils.ts` can be used to delete all data from the database. This is useful for ensuring a clean state between test runs.
