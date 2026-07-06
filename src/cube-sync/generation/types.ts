export type GeneratedDimension = {
  name: string;
  sql: string;
  type: "number" | "string" | "time" | "boolean";
  primary_key?: true;
  description?: string;
  public?: boolean | string;
  meta?: {
    enum?: string[];
    ai_context?: string;
  };
};

export type GeneratedJoin = {
  name: string;
  sql: string;
  relationship: "many_to_one" | "one_to_many" | "one_to_one";
};

export type GeneratedRelationship = {
  cube: string;
  type: GeneratedJoin["relationship"];
};

export type GeneratedCube = {
  name: string;
  sql_table: string;
  data_source: "default";
  public: false;
  description?: string;
  meta?: {
    ai_context?: string;
    relationships?: GeneratedRelationship[];
  };
  joins?: GeneratedJoin[];
  dimensions: GeneratedDimension[];
  measures: Array<{
    name: "count";
    type: "count";
    description: string;
    public: true;
  }>;
};

export type BaseCubeGenerationResult = {
  changedFileCount: number;
};

export type CubeAnnotation = {
  name?: string;
  description?: string;
  aiContext?: string;
  public?: boolean | string;
};
