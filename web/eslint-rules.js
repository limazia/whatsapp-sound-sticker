const EM_DASH = "\u2014";

const noComponentComments = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      found:
        "Componentes React nao podem conter comentarios. Se precisa explicar, renomeie ou quebre o componente. JSDoc so em src/shared/utils/.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({ loc: comment.loc, messageId: "found" });
        }
      },
    };
  },
};

const noEmDash = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      found: "O caractere em dash e proibido. Use hifen comum.",
    },
  },
  create(context) {
    return {
      Program() {
        const { sourceCode } = context;
        const text = sourceCode.getText();

        for (let i = text.indexOf(EM_DASH); i !== -1; i = text.indexOf(EM_DASH, i + 1)) {
          const start = i;

          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(start),
              end: sourceCode.getLocFromIndex(start + 1),
            },
            messageId: "found",
            fix: (fixer) => fixer.replaceTextRange([start, start + 1], "-"),
          });
        }
      },
    };
  },
};

export default {
  rules: {
    "no-component-comments": noComponentComments,
    "no-em-dash": noEmDash,
  },
};
