module.exports = ({ types: t }) => ({
  name: 'replace-better-auth-import-meta',
  visitor: {
    MetaProperty(path) {
      const { node } = path;
      if (node.meta.name !== 'import' || node.property.name !== 'meta') {
        return;
      }

      // Better Auth and Effect read build-time configuration through
      // import.meta.env. Metro has no import.meta, so provide the Better Auth
      // version used by this app and leave optional settings unset.
      path.replaceWith(
        t.objectExpression([
          t.objectProperty(
            t.identifier('env'),
            t.objectExpression([
              t.objectProperty(
                t.identifier('BETTER_AUTH_VERSION'),
                t.stringLiteral('1.7.7'),
              ),
            ]),
          ),
        ]),
      );
    },
  },
});
