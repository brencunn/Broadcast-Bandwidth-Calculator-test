'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddVideoService from './forms/AddVideoService';
import AddAudioService from './forms/AddAudioService';
import AddDataService from './forms/AddDataService';

export default function ServiceManagementCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Add a Service</CardTitle>
                <CardDescription>Add a Video, Audio, or Data service to the circuit.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="video">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="video">Video</TabsTrigger>
                        <TabsTrigger value="audio">Audio</TabsTrigger>
                        <TabsTrigger value="data">Data</TabsTrigger>
                    </TabsList>
                    <TabsContent value="video" className="pt-6">
                        <AddVideoService />
                    </TabsContent>
                    <TabsContent value="audio" className="pt-6">
                        <AddAudioService />
                    </TabsContent>
                    <TabsContent value="data" className="pt-6">
                        <AddDataService />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
