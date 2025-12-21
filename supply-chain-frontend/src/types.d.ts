interface Window {
  trustedTypes: {
    createPolicy: (
      name: string,
      rules: {
        createHTML?: (input: string) => string;
        createScript?: (input: string) => string;
        createScriptURL?: (input: string) => string;
      }
    ) => any;
  };
}
