export type PrismaModelField = {
  name: string;
  zodExpression: string;
};

export type PrismaModel = {
  name: string;
  fields: PrismaModelField[];
  enumImports: string[];
};

export type PrismaEnum = {
  name: string;
  values: string[];
};
