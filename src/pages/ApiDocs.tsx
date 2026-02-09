import { ArrowLeft, Copy, Check, ExternalLink, Key, FileCode, AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const ApiDocs = () => {
  const navigate = useNavigate();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const requestExample = `{
  "method": "register_virgin_wallets_for_existing_user",
  "api_key": "your_api_key",
  "data": {
    "nostr_id_hex": "64-character-hex-string",
    "wallets": [
      {
        "wallet_id": "LxxxxxxxxxxxxxxxxxxxxxxxxL",
        "wallet_type": "Main Wallet",
        "notes": "Optional note"
      },
      {
        "wallet_id": "LyyyyyyyyyyyyyyyyyyyyyyyL",
        "wallet_type": "Wallet",
        "notes": ""
      }
    ]
  }
}`;

  const responseSuccess = `{
  "success": true,
  "status": "ok",
  "message": "Successfully registered 2 virgin wallets",
  "data": {
    "nostr_id_hex": "64-character-hex-string",
    "wallets_registered": 2,
    "wallets": [
      {
        "wallet_id": "LxxxxxxxxxxxxxxxxxxxxxxxxL",
        "wallet_type": "Main Wallet",
        "nostr_broadcast": "success",
        "nostr_event_ids": {
          "kind_87006": "event_id_1",
          "kind_87002": "event_id_2"
        }
      }
    ],
    "nostr_broadcasts": {
      "successful": 2,
      "failed": 0
    }
  },
  "processing_time_ms": 1234,
  "correlation_id": "uuid-string"
}`;

  const responseError = `{
  "success": false,
  "status": "error",
  "error": "Error message description",
  "correlation_id": "uuid-string"
}`;

  const curlExample = `curl -X POST \\
  'https://laluxmwarlejdwyboudz.supabase.co/functions/v1/register-virgin-wallets' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "method": "register_virgin_wallets_for_existing_user",
    "api_key": "your_api_key",
    "data": {
      "nostr_id_hex": "your_nostr_hex_id",
      "wallets": [
        {
          "wallet_id": "LxxxxxxxxxxxxxxxxxxxxxxxxL",
          "wallet_type": "Main Wallet"
        }
      ]
    }
  }'`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">L</span>
                </div>
                <span className="text-xl font-semibold text-foreground">API Documentation</span>
              </div>
            </div>
            <a 
              href="https://lanawatch.us" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              lanawatch.us
            </a>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Introduction */}
        <div className="mb-8">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Lana Register API</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            External API for integrating with the Lana Register system. Register virgin wallets for existing users 
            and broadcast registration events to the Nostr network.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Base URL</h3>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono text-foreground">https://laluxmwarlejdwyboudz.supabase.co</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard('https://laluxmwarlejdwyboudz.supabase.co', 'baseurl')}
                className="h-7 gap-1"
              >
                {copiedSection === 'baseurl' ? (
                  <><Check className="h-3 w-3" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy</>
                )}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" />
              REST API
            </Badge>
            <Badge variant="outline">JSON</Badge>
            <a 
              href="https://lanawatch.us" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-sm ml-4"
            >
              Official Website
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Authentication Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Authentication
            </CardTitle>
            <CardDescription>
              All API requests require authentication via API key
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              API keys are provided to authorized services only. The API key must be included in the request body 
              as the <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">api_key</code> field.
            </p>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> To obtain an API key, please contact the Lana Register administrators 
                through the official website at{" "}
                <a href="https://lanawatch.us" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  lanawatch.us
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Endpoint Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Register Virgin Wallets
            </CardTitle>
            <CardDescription>
              Bulk register zero-balance (virgin) wallets for an existing user profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Endpoint URL */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Endpoint</h4>
              <div className="flex items-center gap-2">
                <Badge className="bg-success text-success-foreground">POST</Badge>
                <code className="px-3 py-1.5 rounded bg-muted text-foreground text-sm font-mono">
                  /functions/v1/register-virgin-wallets
                </code>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
              <p className="text-foreground">
                This endpoint allows you to register up to <strong>8 virgin wallets</strong> (zero-balance wallets) 
                for an existing user profile. The user must already have a profile in the system, identified by 
                their Nostr hex ID.
              </p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Validates that all wallets have zero balance before registration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Broadcasts KIND 87006 (Virgin Wallet Confirmation) and KIND 87002 (Registration Confirmation) events
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Updates KIND 30889 (Wallet List) with the new wallets
                </li>
              </ul>
            </div>

            {/* Request Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Request Body</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(requestExample, 'request')}
                  className="h-8 gap-1"
                >
                  {copiedSection === 'request' ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy</>
                  )}
                </Button>
              </div>
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-foreground">{requestExample}</code>
              </pre>
            </div>

            {/* Parameters Table */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Parameters</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-sm">method</TableCell>
                    <TableCell><Badge variant="outline">string</Badge></TableCell>
                    <TableCell><Badge className="bg-destructive/10 text-destructive border-destructive/20">Required</Badge></TableCell>
                    <TableCell className="text-muted-foreground">Must be "register_virgin_wallets_for_existing_user"</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">api_key</TableCell>
                    <TableCell><Badge variant="outline">string</Badge></TableCell>
                    <TableCell><Badge className="bg-destructive/10 text-destructive border-destructive/20">Required</Badge></TableCell>
                    <TableCell className="text-muted-foreground">Your API authentication key</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">data.nostr_id_hex</TableCell>
                    <TableCell><Badge variant="outline">string</Badge></TableCell>
                    <TableCell><Badge className="bg-destructive/10 text-destructive border-destructive/20">Required</Badge></TableCell>
                    <TableCell className="text-muted-foreground">64-character hex string of the user's Nostr public key</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">data.wallets</TableCell>
                    <TableCell><Badge variant="outline">array</Badge></TableCell>
                    <TableCell><Badge className="bg-destructive/10 text-destructive border-destructive/20">Required</Badge></TableCell>
                    <TableCell className="text-muted-foreground">Array of 1-8 wallet objects to register</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">data.wallets[].wallet_id</TableCell>
                    <TableCell><Badge variant="outline">string</Badge></TableCell>
                    <TableCell><Badge className="bg-destructive/10 text-destructive border-destructive/20">Required</Badge></TableCell>
                    <TableCell className="text-muted-foreground">LANA wallet address (starts with 'L', 26-35 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">data.wallets[].wallet_type</TableCell>
                    <TableCell><Badge variant="outline">string</Badge></TableCell>
                    <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                    <TableCell className="text-muted-foreground">Wallet type (defaults to "Main Wallet")</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">data.wallets[].notes</TableCell>
                    <TableCell><Badge variant="outline">string</Badge></TableCell>
                    <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                    <TableCell className="text-muted-foreground">Optional notes for the wallet</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Success Response */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Success Response (200)</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(responseSuccess, 'success')}
                  className="h-8 gap-1"
                >
                  {copiedSection === 'success' ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy</>
                  )}
                </Button>
              </div>
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-foreground">{responseSuccess}</code>
              </pre>
            </div>

            {/* Error Response */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Error Response</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(responseError, 'error')}
                  className="h-8 gap-1"
                >
                  {copiedSection === 'error' ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy</>
                  )}
                </Button>
              </div>
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-foreground">{responseError}</code>
              </pre>
            </div>

            {/* cURL Example */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">cURL Example</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(curlExample, 'curl')}
                  className="h-8 gap-1"
                >
                  {copiedSection === 'curl' ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy</>
                  )}
                </Button>
              </div>
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-foreground">{curlExample}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Error Codes
            </CardTitle>
            <CardDescription>
              HTTP status codes returned by the API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell><Badge variant="outline">400</Badge></TableCell>
                  <TableCell className="font-medium">Bad Request</TableCell>
                  <TableCell className="text-muted-foreground">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Invalid method (not "register_virgin_wallets_for_existing_user")</li>
                      <li>Invalid nostr_id_hex format (not 64-char hex)</li>
                      <li>Invalid wallet count (must be 1-8)</li>
                      <li>Invalid wallet address format (must start with 'L', 26-35 chars, alphanumeric)</li>
                      <li>Non-virgin wallet detected (balance {'>'} 0)</li>
                    </ul>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="outline">401</Badge></TableCell>
                  <TableCell className="font-medium">Unauthorized</TableCell>
                  <TableCell className="text-muted-foreground">Invalid or missing API key</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="outline">404</Badge></TableCell>
                  <TableCell className="font-medium">Not Found</TableCell>
                  <TableCell className="text-muted-foreground">Profile not found for the given nostr_id_hex</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="outline">409</Badge></TableCell>
                  <TableCell className="font-medium">Conflict</TableCell>
                  <TableCell className="text-muted-foreground">One or more wallets are already registered in the system</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="outline">500</Badge></TableCell>
                  <TableCell className="font-medium">Server Error</TableCell>
                  <TableCell className="text-muted-foreground">
                    <ul className="list-disc list-inside space-y-1">
                      <li>API key configuration not found on server</li>
                      <li>System parameters not available</li>
                      <li>Failed to validate wallet balances (Electrum server issue)</li>
                      <li>Database error during registration</li>
                      <li>Unexpected internal error</li>
                    </ul>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 border-t border-border">
          <p className="text-muted-foreground">
            For more information, visit the official website at{" "}
            <a 
              href="https://lanawatch.us" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline font-medium"
            >
              lanawatch.us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
