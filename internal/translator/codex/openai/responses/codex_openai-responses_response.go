package responses

import (
	"bytes"
	"context"
	"fmt"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// ConvertCodexResponseToOpenAIResponses converts OpenAI Chat Completions streaming chunks
// to OpenAI Responses SSE events (response.*).

func ConvertCodexResponseToOpenAIResponses(ctx context.Context, modelName string, originalRequestRawJSON, requestRawJSON, rawJSON []byte, param *any) []string {
	if bytes.HasPrefix(rawJSON, []byte("data:")) {
		rawJSON = bytes.TrimSpace(rawJSON[5:])
		if typeResult := gjson.GetBytes(rawJSON, "type"); typeResult.Exists() {
			typeStr := typeResult.String()
			if typeStr == "response.created" || typeStr == "response.in_progress" || typeStr == "response.completed" {
				rawJSON, _ = sjson.SetBytes(rawJSON, "response.instructions", gjson.GetBytes(originalRequestRawJSON, "instructions").String())
			}
		}
		out := fmt.Sprintf("data: %s", string(rawJSON))
		return []string{out}
	}
	return []string{string(rawJSON)}
}

// ConvertCodexResponseToOpenAIResponsesNonStream builds a single Responses JSON
// from a non-streaming OpenAI Chat Completions response.
func ConvertCodexResponseToOpenAIResponsesNonStream(_ context.Context, modelName string, originalRequestRawJSON, requestRawJSON, rawJSON []byte, _ *any) string {
	if !gjson.ValidBytes(rawJSON) {
		return convertCodexSSEToOpenAIResponsesNonStream(originalRequestRawJSON, rawJSON)
	}

	rootResult := gjson.ParseBytes(rawJSON)
	// Verify this is a response.completed event
	if rootResult.Get("type").String() != "response.completed" {
		return ""
	}
	responseResult := rootResult.Get("response")
	template := responseResult.Raw
	template, _ = sjson.Set(template, "instructions", gjson.GetBytes(originalRequestRawJSON, "instructions").String())
	return template
}

func convertCodexSSEToOpenAIResponsesNonStream(originalRequestRawJSON, rawJSON []byte) string {
	template := `{"id":"","object":"response","created_at":0,"status":"completed","background":false,"error":null,"incomplete_details":null,"output":[]}`
	template, _ = sjson.Set(template, "instructions", gjson.GetBytes(originalRequestRawJSON, "instructions").String())

	var contentText string
	var reasoningText string
	var outputs []string

	for _, line := range bytes.Split(rawJSON, []byte("\n")) {
		if !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		line = bytes.TrimSpace(line[5:])
		if !gjson.ValidBytes(line) {
			continue
		}
		rootResult := gjson.ParseBytes(line)
		switch rootResult.Get("type").String() {
		case "response.created", "response.completed":
			response := rootResult.Get("response")
			if response.Exists() {
				for _, field := range []string{"id", "object", "created_at", "status", "background", "error", "incomplete_details", "model", "parallel_tool_calls", "usage", "text", "reasoning", "tools", "temperature", "top_p", "tool_choice", "max_output_tokens", "previous_response_id", "store", "service_tier", "truncation"} {
					if v := response.Get(field); v.Exists() {
						template, _ = sjson.SetRaw(template, field, v.Raw)
					}
				}
			}
		case "response.output_text.delta":
			contentText += rootResult.Get("delta").String()
		case "response.reasoning_summary_text.delta":
			reasoningText += rootResult.Get("delta").String()
		case "response.output_item.done":
			itemResult := rootResult.Get("item")
			if !itemResult.Exists() {
				continue
			}
			if itemResult.Get("type").String() == "function_call" {
				outputs = append(outputs, itemResult.Raw)
			}
		}
	}

	if reasoningText != "" {
		reasoningItem := `{"id":"","type":"reasoning","summary":[{"type":"summary_text","text":""}]}`
		reasoningItem, _ = sjson.Set(reasoningItem, "summary.0.text", reasoningText)
		outputs = append(outputs, reasoningItem)
	}
	if contentText != "" {
		messageItem := `{"id":"","type":"message","status":"completed","content":[{"type":"output_text","annotations":[],"logprobs":[],"text":""}],"role":"assistant"}`
		messageItem, _ = sjson.Set(messageItem, "content.0.text", contentText)
		outputs = append(outputs, messageItem)
	}
	if len(outputs) > 0 {
		template, _ = sjson.SetRaw(template, "output", `[ ]`)
		for _, output := range outputs {
			template, _ = sjson.SetRaw(template, "output.-1", output)
		}
	}

	return template
}
