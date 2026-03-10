'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating custom reports based on user-defined parameters.
 *
 * It uses generative AI to select the most effective chart types for data visualization, enabling warehouse managers to quickly analyze warehouse operations data.
 *
 * @exports generateCustomReport - A function that triggers the custom report generation flow.
 * @exports GenerateCustomReportInput - The input type for the generateCustomReport function.
 * @exports GenerateCustomReportOutput - The output type for the generateCustomReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCustomReportInputSchema = z.object({
  reportTitle: z.string().describe('The title of the report.'),
  dataDescription: z
    .string()
    .describe(
      'A description of the data to be included in the report, including key metrics and dimensions.'
    ),
  userParameters: z
    .string()
    .describe(
      'A description of user-defined parameters for the report, such as date ranges, specific products, or warehouse locations.'
    ),
  preferredChartTypes: z
    .string()    
    .optional()
    .describe(
      'Optional. A comma-separated list of preferred chart types (e.g., bar chart, line chart, pie chart).  The AI should attempt to use these if appropriate.'
    ),
});

export type GenerateCustomReportInput = z.infer<typeof GenerateCustomReportInputSchema>;

const GenerateCustomReportOutputSchema = z.object({
  reportDescription: z
    .string()
    .describe(
      'A detailed description of the generated report, including the selected chart types and their rationale.'
    ),
  chartSuggestions: z
    .string()
    .describe(
      'Suggestions for the best chart types to visualize the data, based on the data description and user parameters.'
    ),
});

export type GenerateCustomReportOutput = z.infer<typeof GenerateCustomReportOutputSchema>;

export async function generateCustomReport(
  input: GenerateCustomReportInput
): Promise<GenerateCustomReportOutput> {
  return generateCustomReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCustomReportPrompt',
  input: {schema: GenerateCustomReportInputSchema},
  output: {schema: GenerateCustomReportOutputSchema},
  prompt: `You are an expert data visualization specialist.  You will generate a custom report description and suggest the best chart types based on the provided data description, user parameters, and preferred chart types.

  Report Title: {{{reportTitle}}}
  Data Description: {{{dataDescription}}}
  User Parameters: {{{userParameters}}}
  Preferred Chart Types (if any): {{{preferredChartTypes}}}

  Based on this information, provide:

  1.  A detailed description of the generated report, including the selected chart types and their rationale.
  2.  Suggestions for the best chart types to visualize the data, based on the data description and user parameters.
  `,
});

const generateCustomReportFlow = ai.defineFlow(
  {
    name: 'generateCustomReportFlow',
    inputSchema: GenerateCustomReportInputSchema,
    outputSchema: GenerateCustomReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
