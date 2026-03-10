"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Paperclip, UploadCloud, X, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import prettyBytes from "pretty-bytes";
import { addAttachment } from "@/app/dashboard/tasks/actions";
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";

type TaskAttachmentsProps = {
    task: SerializableTask;
    users: SerializableUserProfile[];
    onAttachmentsUpdate: () => void;
};

export function TaskAttachments({ task, users, onAttachmentsUpdate }: TaskAttachmentsProps) {
    const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    const onDrop = (acceptedFiles: File[]) => {
        setUploadingFiles(prev => [...prev, ...acceptedFiles]);
        acceptedFiles.forEach(file => handleUpload(file));
    };

    const handleUpload = async (file: File) => {
        const formData = new FormData();
        formData.append("taskId", task.id);
        formData.append("file", file);

        // This part is tricky without being able to stream progress from server actions.
        // We'll use the client-side SDK for upload progress.
        const storage = getStorage();
        const storageRef = ref(storage, `tasks/${task.id}/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            },
            (error) => {
                console.error("Upload failed:", error);
                // Handle unsuccessful uploads
            },
            async () => {
                // The server action will handle adding the metadata to Firestore
                await addAttachment(formData);
                setUploadingFiles(files => files.filter(f => f.name !== file.name));
                onAttachmentsUpdate();
            }
        );
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: true,
    });

    const removeAttachment = async (fileId: string) => {
        // Handle file deletion logic here
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold">Attachments</h4>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <UploadCloud className="h-8 w-8" />
                    {isDragActive ? (
                        <p>Drop the files here ...</p>
                    ) : (
                        <p>Drag & drop some files here, or click to select files</p>
                    )}
                </div>
            </div>

            {/* Uploading Files */}
            {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                    {uploadingFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                            <FileIcon className="h-6 w-6" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">{file.name}</p>
                                <Progress value={uploadProgress[file.name] || 0} className="h-2" />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setUploadingFiles(files => files.filter(f => f.name !== file.name))}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Existing Attachments */}
            {task.attachments && task.attachments.length > 0 && (
                <div className="space-y-2">
                    {task.attachments.map((attachment) => (
                        <Card key={attachment.id}>
                            <CardContent className="p-3 flex items-center gap-3">
                                <FileIcon className="h-8 w-8 text-muted-foreground" />
                                <div className="flex-1">
                                    <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                                        {attachment.fileName}
                                    </a>
                                    <p className="text-sm text-muted-foreground">
                                        {prettyBytes(attachment.size)}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeAttachment(attachment.id)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
