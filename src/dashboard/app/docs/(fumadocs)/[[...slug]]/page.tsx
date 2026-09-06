import { source } from "@/lib/source";
import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { MDXContent } from "mdx/types";
import type { TOCItemType } from "fumadocs-core/toc";

interface FumadocsPageData {
    body: MDXContent;
    toc: TOCItemType[];
    full: boolean;
    title: string;
    description?: string;
}

function normalizeSlug(slug?: string[]) {
    return slug ?? [];
}

export default async function Page(props: {
    params: Promise<{ slug?: string[] }>;
}) {
    const params = await props.params;
    const page = source.getPage(normalizeSlug(params.slug));
    if (!page) notFound();

    const data = page.data as unknown as FumadocsPageData;
    const MDX = data.body;

    return (
        <DocsPage toc={data.toc} full={data.full}>
            <DocsTitle>{data.title}</DocsTitle>
            <DocsDescription>{data.description}</DocsDescription>
            <DocsBody>
                <MDX components={getMDXComponents()} />
            </DocsBody>
        </DocsPage>
    );
}

export async function generateMetadata(props: {
    params: Promise<{ slug?: string[] }>;
}) {
    const params = await props.params;
    const page = source.getPage(normalizeSlug(params.slug));
    if (!page) notFound();

    const data = page.data as unknown as FumadocsPageData;
    return {
        title: data.title,
        description: data.description,
    };
}
