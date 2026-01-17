/**
 * Extract TypeScript type schema from tool files using AST parsing
 */

import * as ts from 'typescript';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';

export interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface ParameterSchema {
  typeName: string;
  properties: PropertyInfo[];
}

/**
 * Extract the input type schema from a tool file
 */
export async function extractInputSchema(toolFilePath: string): Promise<ParameterSchema | null> {
  try {
    const toolContent = await readFile(toolFilePath, 'utf-8');
    const toolSourceFile = ts.createSourceFile(
      toolFilePath,
      toolContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Find the imported type name from ./types.js
    const importedTypeName = findImportedTypeName(toolSourceFile);
    if (!importedTypeName) {
      return null;
    }

    // Read and parse the types.ts file
    const typesFilePath = join(dirname(toolFilePath), 'types.ts');
    const typesContent = await readFile(typesFilePath, 'utf-8');
    const typesSourceFile = ts.createSourceFile(
      typesFilePath,
      typesContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Find the interface definition
    const properties = findInterfaceProperties(typesSourceFile, importedTypeName);
    if (!properties) {
      return null;
    }

    return {
      typeName: importedTypeName,
      properties,
    };
  } catch {
    return null;
  }
}

/**
 * Find the type name imported from ./types.js
 */
function findImportedTypeName(sourceFile: ts.SourceFile): string | null {
  let typeName: string | null = null;

  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const modulePath = moduleSpecifier.text;
        // Match imports from ./types.js or ./types
        if (modulePath === './types.js' || modulePath === './types') {
          const importClause = node.importClause;
          if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const element of importClause.namedBindings.elements) {
              const name = element.name.text;
              // Look for Input types (convention: *Input)
              if (name.endsWith('Input')) {
                typeName = name;
                break;
              }
            }
          }
        }
      }
    }
  });

  return typeName;
}

/**
 * Find interface properties by name
 */
function findInterfaceProperties(sourceFile: ts.SourceFile, interfaceName: string): PropertyInfo[] | null {
  let properties: PropertyInfo[] | null = null;

  ts.forEachChild(sourceFile, node => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      properties = [];
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const propType = member.type ? typeToString(member.type, sourceFile) : 'unknown';
          const optional = !!member.questionToken;
          const description = getJSDocDescription(member, sourceFile);

          properties.push({
            name: propName,
            type: propType,
            optional,
            description,
          });
        }
      }
    }
  });

  return properties;
}

/**
 * Convert a TypeNode to a readable string
 */
function typeToString(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): string {
  // Handle common types more readably
  if (ts.isArrayTypeNode(typeNode)) {
    const elementType = typeToString(typeNode.elementType, sourceFile);
    return `${elementType}[]`;
  }

  if (ts.isUnionTypeNode(typeNode)) {
    const types = typeNode.types.map(t => typeToString(t, sourceFile));
    return types.join(' | ');
  }

  if (ts.isLiteralTypeNode(typeNode)) {
    if (ts.isStringLiteral(typeNode.literal)) {
      return `'${typeNode.literal.text}'`;
    }
    return typeNode.literal.getText(sourceFile);
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    const members = typeNode.members.map(member => {
      if (ts.isPropertySignature(member) && member.name && member.type) {
        const name = member.name.getText(sourceFile);
        const type = typeToString(member.type, sourceFile);
        const opt = member.questionToken ? '?' : '';
        return `${name}${opt}: ${type}`;
      }
      return '';
    }).filter(Boolean);
    return `{ ${members.join(', ')} }`;
  }

  // For other types, use the text representation
  return typeNode.getText(sourceFile);
}

/**
 * Extract JSDoc description from a node
 */
function getJSDocDescription(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const jsDocTags = ts.getJSDocTags(node);
  for (const tag of jsDocTags) {
    if (tag.comment) {
      if (typeof tag.comment === 'string') {
        return tag.comment;
      }
      // Handle JSDocComment array
      return tag.comment.map(c => c.text).join('');
    }
  }

  // Check for leading comment
  const fullText = sourceFile.getFullText();
  const nodeStart = node.getFullStart();
  const leadingComments = ts.getLeadingCommentRanges(fullText, nodeStart);

  if (leadingComments && leadingComments.length > 0) {
    const lastComment = leadingComments[leadingComments.length - 1];
    const commentText = fullText.slice(lastComment.pos, lastComment.end);
    // Extract from /** ... */ style comments
    const match = commentText.match(/\/\*\*?\s*(.+?)\s*\*\//s);
    if (match) {
      return match[1].replace(/^\s*\*\s*/gm, '').trim();
    }
  }

  return undefined;
}

/**
 * Format a ParameterSchema for display
 */
export function formatSchema(schema: ParameterSchema): string {
  if (schema.properties.length === 0) {
    return `Parameters (${schema.typeName}): none`;
  }

  const lines = schema.properties.map(prop => {
    const optMarker = prop.optional ? '?' : '';
    const reqMarker = prop.optional ? '' : ' (required)';
    let line = `  ${prop.name}${optMarker}: ${prop.type}${reqMarker}`;
    if (prop.description) {
      line += `\n    ${prop.description}`;
    }
    return line;
  });

  return `Parameters (${schema.typeName}):\n${lines.join('\n')}`;
}
