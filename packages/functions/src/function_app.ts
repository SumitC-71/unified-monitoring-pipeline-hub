import { UserDataFunctions } from '@microsoft/fabric-user-data-functions';

const udf = new UserDataFunctions();

udf.func(
  'helloWorld',
  (firstName: string, lastName: string): string =>
    `Hello ${firstName} ${lastName}!`,
  []
);

udf.func(
  'logMessage',
  (): void => {
    console.log('this message is from rayfin function, and it works fine');
  },
  []
);
