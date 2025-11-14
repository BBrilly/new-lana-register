import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

const AdminPanel = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
        </div>
        
        <Card className="p-8">
          <p className="text-muted-foreground text-center">
            Admin vmesnik - v razvoju
          </p>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminPanel;
