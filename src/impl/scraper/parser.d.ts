import Parser from 'rss-parser';
export declare function clean(input: string): string;
export declare function title(entry: {
    title?: string;
}): string;
export declare function description(entry: {
    summary?: string;
    content?: {
        body?: string;
    };
}): string;
export declare function truncate(text: string, maxLength: number): string;
export declare function parseFeed(content: string): Promise<{
    [key: string]: any;
} & Parser.Output<{
    [key: string]: any;
}>>;
