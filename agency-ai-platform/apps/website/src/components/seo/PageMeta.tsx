import { Helmet } from "react-helmet-async";
import { COMPANY } from "@/data/placeholders";

type PageMetaProps = {
  title: string;
  description: string;
  path?: string;
};

export function PageMeta({ title, description, path = "/" }: PageMetaProps) {
  const fullTitle = title === COMPANY.name ? title : `${title} · ${COMPANY.name}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <link rel="canonical" href={path} />
    </Helmet>
  );
}
