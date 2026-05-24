export interface Arc32Method {
  name: string;
  desc?: string;
  args: Array<{
    name: string;
    type: string;
    desc?: string;
  }>;
  returns: {
    type: string;
    desc?: string;
  };
  readonly?: boolean;
}

export interface Arc32Contract {
  contract: {
    name: string;
    desc?: string;
    methods: Arc32Method[];
  };
  source?: {
    approval: string;
    clear: string;
  };
  state?: {
    global: { num_uints: number; num_byte_slices: number };
    local: { num_uints: number; num_byte_slices: number };
  };
  schema?: Record<string, unknown>;
}
