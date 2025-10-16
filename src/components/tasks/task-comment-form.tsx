"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addComment } from "@/app/dashboard/tasks/actions";

type TaskCommentFormProps = {
    taskId: string;
    onCommentAdded: () => void;
};

const commentFormSchema = z.object({
    comment: z.string().min(1, "Comment cannot be empty."),
});

export function TaskCommentForm({ taskId, onCommentAdded }: TaskCommentFormProps) {
    const form = useForm<z.infer<typeof commentFormSchema>>({
        resolver: zodResolver(commentFormSchema),
        defaultValues: {
            comment: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof commentFormSchema>) => {
        const formData = new FormData();
        formData.append("taskId", taskId);
        formData.append("comment", values.comment);

        const result = await addComment(formData);
        if (result.success) {
            form.reset();
            if (onCommentAdded) {
                onCommentAdded();
            }
        } else {
            // Handle error, e.g., show a toast notification
            console.error("Failed to add comment:", result.errors);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
                <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Textarea
                                    placeholder="Add a comment... (use @ to mention someone)"
                                    className="resize-none"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <Button type="submit" size="sm" className="self-end">
                    Comment
                </Button>
            </form>
        </Form>
    );
}
