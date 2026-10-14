module.exports = ({ types: t }) => ({
  name: 'replace-better-auth-import-meta',
  visitor: {
    MemberExpression(path) {
      const { node } = path;
      const object = node.object;

      if (
        node.computed ||
        node.property.name !== 'env' ||
        !t.isMetaProperty(object) ||
        object.meta.name !== 'import' ||
        object.property.name !== 'meta'
      ) {
        return;
      }

      // Better Auth reads its package version and optional telemetry settings
      // through import.meta.env. Metro has no import.meta.env, so provide the
      // version used by this app and leave the optional settings unset.
      path.replaceWith(
        t.objectExpression([
          t.objectProperty(
            t.identifier('BETTER_AUTH_VERSION'),
            t.stringLiteral('1.7.7'),
          ),
        ]),
      );
    },
  },
});
