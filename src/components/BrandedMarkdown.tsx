/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Brand-styled wrapper around react-markdown. Component overrides give us
 * precise control over the SOP look (blok steel + orange + Barlow headings)
 * without depending on @tailwindcss/typography.
 */

import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
}

export const BrandedMarkdown: React.FC<Props> = ({ children }) => {
  return (
    <div className="branded-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-display text-3xl font-bold text-indigo-900 tracking-tight mt-0 mb-3">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-2xl font-semibold text-slate-900 tracking-tight mt-8 mb-3 pb-2 border-b-2 border-slate-200">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-lg font-semibold text-slate-900 mt-6 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-display text-base font-semibold text-slate-800 mt-4 mb-2">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[15px] leading-[1.75] text-slate-700 my-3">{children}</p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-700 font-medium underline decoration-amber-500 decoration-2 underline-offset-4 hover:decoration-amber-600 transition-colors"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
          code: ({ children, className }) => {
            // Inline vs. block — react-markdown sets className on block code
            const isBlock = !!className;
            if (isBlock) {
              return (
                <code className="block font-mono text-[13px] leading-relaxed text-slate-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[0.92em] text-indigo-700">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto my-4 border-l-4 border-amber-500 font-mono text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-amber-400 bg-amber-50 px-4 py-2 my-4 rounded-r-lg text-slate-700">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 my-3 space-y-1.5 text-[15px] leading-[1.7] text-slate-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 my-3 space-y-1.5 text-[15px] leading-[1.7] text-slate-700">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
          hr: () => <hr className="my-8 border-t border-slate-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-indigo-600">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="even:bg-slate-50 border-t border-slate-200 first:border-t-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="text-left text-white font-display font-semibold text-[13px] uppercase tracking-wider px-4 py-3">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-slate-700 leading-relaxed">{children}</td>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ''} className="my-4 rounded-lg border border-slate-200 max-w-full" />
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
};
