import { KNOWLEDGE_ARTICLE_STATUS_PIPELINE, KNOWLEDGE_DOMAIN_MODELS } from "@agency/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_KNOWLEDGE_ARTICLES } from "@/data/placeholders";

export function KnowledgePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Knowledge"
        description={`${KNOWLEDGE_DOMAIN_MODELS.join(" · ")}. Target API: GET /api/v1/admin/knowledge/articles`}
      />
      <PlaceholderBadge />
      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="font-display text-lg font-bold">Article status</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {KNOWLEDGE_ARTICLE_STATUS_PIPELINE.map((step, index) => (
            <li key={step.status} className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <p className="text-xs font-bold text-[var(--color-accent)]">
                {index + 1}. {step.label}
              </p>
              <p className="text-muted mt-1 text-xs leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Visibility</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_KNOWLEDGE_ARTICLES.map((article) => (
              <tr key={article.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{article.title}</p>
                  <p className="text-muted text-xs">{article.slug}</p>
                </td>
                <td className="px-4 py-3">{article.category}</td>
                <td className="px-4 py-3">
                  <StatusPill label={article.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill label={article.visibility} />
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{article.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
