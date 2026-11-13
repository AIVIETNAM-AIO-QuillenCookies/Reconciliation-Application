section Section1;

shared Finance_GL_Revenue_FY2025 = let
    Source = Excel.Workbook(File.Contents("D:\DA\data 2\Finance_GL_Revenue_FY2025.xlsx"), null, true),
    GL_Revenue_Sheet = Source{[Item="GL_Revenue",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(GL_Revenue_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"journal_id", type text}, {"posting_date", Int64.Type}, {"period", type date}, {"account", Int64.Type}, {"journal_type", type text}, {"store_code", type text}, {"channel", type text}, {"currency", type text}, {"amount_local", type number}, {"fx_rate_month_end", type number}, {"amount_usd", type number}, {"description", type text}, {"source_ref", type any}})
in
    #"Changed Type";

shared Sales_Flash_Report_2025 = let
    Source = Excel.Workbook(File.Contents("D:\DA\data 2\Sales_Flash_Report_2025.xlsx"), null, true),
    Flash_Sheet = Source{[Item="Flash",Kind="Sheet"]}[Data]
in
    Flash_Sheet;

shared q_FLASH_Raw = let
    Source = Sales_Flash_Report_2025,
    #"Removed Top Rows" = Table.Skip(Source,4),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Tháng", type text}, {"Kênh", type text}, {"Thị trường", type text}, {"Số đơn", Int64.Type}, {"Doanh số (USD)", Int64.Type}}),
    #"Removed Bottom Rows" = Table.RemoveLastN(#"Changed Type",1)
in
    #"Removed Bottom Rows";

shared q_GL_Raw = let
    Source = Excel.Workbook(File.Contents("D:\DA\data 2\Finance_GL_Revenue_FY2025.xlsx"), null, true),
    GL_Revenue_Sheet = Source{[Item="GL_Revenue",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(GL_Revenue_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"journal_id", type text}, {"posting_date", type date}, {"period", type text}, {"account", type text}, {"journal_type", type text}, {"store_code", type text}, {"channel", type text}, {"currency", type text}, {"amount_local", type number}, {"fx_rate_month_end", type number}, {"amount_usd", type number}, {"description", type text}, {"source_ref", type text}})
in
    #"Changed Type";